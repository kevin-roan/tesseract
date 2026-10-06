import posixpath
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING

from gi.repository import Gtk, Pango

from ...api.errors import describe_error
from ...api.tasks import Task
from ...api.types import SyncFileChange
from ...syncback.diff import MAX_PREVIEW_BYTES, DiffLine, FileDiff, TooLarge, diff_file, extract_member, read_host_file
from ...syncback.summary import plural
from ...util.format import format_bytes
from ...widgets.dialog import DialogShell
from ...widgets.feedback import Notice, tone_foreground
from ...widgets.text import Text
from .labels import SYNC, SYNC_REVIEW
from .model import SyncView, sync_change_code

if TYPE_CHECKING:
    from ...context import AppContext

REVIEW_WIDTH = 1120
REVIEW_HEIGHT = 720
SIDEBAR_WIDTH = 360
KIND_ORDER = ("added", "modified", "deleted")


class SyncReviewDialog(DialogShell):
    """The landscape "Sync to host" review: every changed file on the left, the host-vs-sandbox diff of the
    selected one on the right, and the Sync button in the footer."""

    def __init__(self, ctx: "AppContext", project_id: str, view: SyncView, on_confirm: Callable[[bool, list[str]], None]) -> None:
        super().__init__(SYNC_REVIEW["title"], project_id, "sync", width=REVIEW_WIDTH, height=REVIEW_HEIGHT)
        self.add_css_class("to-sync-review")
        assert view.link is not None
        self._ctx = ctx
        self._project_id = project_id
        self._root = Path(view.link.host_path)
        self._files = {change["path"]: change for change in view.files}
        self._conflicts = view.conflicts
        self._diffs: dict[str, FileDiff | BaseException] = {}
        self._task: Task | None = None
        self._shown: str | None = None

        paned = Gtk.Paned(
            orientation=Gtk.Orientation.HORIZONTAL, position=SIDEBAR_WIDTH, shrink_start_child=False, resize_start_child=False
        )
        paned.set_start_child(self._build_sidebar(view))
        paned.set_end_child(self._build_diff())
        self.set_content(paned)

        paths = list(self._files)
        conflicts = [path for path in paths if path in self._conflicts]
        self.add_action(SYNC["cancel"], self.close)
        self.footer_start.append(Text(SYNC_REVIEW["snapshot"], "caption", "textTertiary"))
        label = SYNC["confirm_force"] if conflicts else f"{SYNC['confirm']} {plural(len(paths), 'file')}"
        self.confirm = self.add_action(label, None, "primary")
        if conflicts:
            self.confirm.add_css_class("destructive-action")

        def confirmed(*_args) -> None:
            self.close()
            on_confirm(bool(conflicts), paths)

        self.confirm.connect("clicked", confirmed)
        self.connect("closed", lambda *_: self._cancel_task())
        if paths:
            self._selection.set_selected(0)
            self._show(self._visible_path(0))

    # Sidebar: destination, counts, conflicts, filter and the file list.

    def _build_sidebar(self, view: SyncView) -> Gtk.Widget:
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10, css_classes=["to-sync-review-sidebar"])
        destination = Text(SYNC_REVIEW["destination"].format(path=view.link.host_path), "caption", "textSecondary")
        destination.set_ellipsize(Pango.EllipsizeMode.MIDDLE)
        destination.set_tooltip_text(view.link.host_path)
        box.append(destination)
        total = (view.changes or {}).get("totalBytes", 0)
        box.append(Text(SYNC_REVIEW["stats"].format(count=plural(len(self._files), "file"), size=format_bytes(total)), "bodyStrong"))

        counts = Gtk.Box(spacing=12)
        for kind in KIND_ORDER:
            count = sum(1 for change in self._files.values() if change["kind"] == kind)
            if not count:
                continue
            code, tone = sync_change_code(kind)
            pill = Gtk.Box(spacing=4)
            pill.append(Text(code, "code", tone_foreground(tone)))
            pill.append(Text(f"{count} {kind}", "caption", "textSecondary"))
            counts.append(pill)
        box.append(counts)

        conflicts = [path for path in self._files if path in self._conflicts]
        if conflicts:
            box.append(Notice(SYNC_REVIEW["conflicts"].format(count=plural(len(conflicts), "file")), tone="warning"))

        self._filter_text = ""
        search = Gtk.SearchEntry(placeholder_text=SYNC_REVIEW["filter"], hexpand=True)
        search.connect("search-changed", self._filter_changed)
        box.append(search)

        self._paths = Gtk.StringList.new(sorted(self._files, key=self._sort_key))
        self._filter = Gtk.CustomFilter.new(lambda item: self._filter_text in item.get_string().lower())
        self._filtered = Gtk.FilterListModel(model=self._paths, filter=self._filter)
        self._selection = Gtk.SingleSelection(model=self._filtered, autoselect=False, can_unselect=False)
        self._selection.connect("selection-changed", lambda *_: self._show(self._visible_path(self._selection.get_selected())))
        factory = Gtk.SignalListItemFactory()
        factory.connect("setup", lambda _f, item: item.set_child(_FileRow()))
        factory.connect("bind", self._bind_file)
        files = Gtk.ListView(model=self._selection, factory=factory, css_classes=["to-sync-review-files"])
        self._no_match = Text(SYNC_REVIEW["no_match"], "caption", "textTertiary", center=True)
        self._no_match.set_visible(False)
        box.append(self._no_match)
        box.append(Gtk.ScrolledWindow(child=files, vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER))
        return box

    def _sort_key(self, path: str) -> tuple[bool, str]:
        return path not in self._conflicts, path

    def _filter_changed(self, entry: Gtk.SearchEntry) -> None:
        self._filter_text = entry.get_text().strip().lower()
        self._filter.changed(Gtk.FilterChange.DIFFERENT)
        self._no_match.set_visible(self._filtered.get_n_items() == 0)

    def _visible_path(self, position: int) -> str | None:
        if position == Gtk.INVALID_LIST_POSITION or position >= self._filtered.get_n_items():
            return None
        return self._filtered.get_item(position).get_string()

    def _bind_file(self, _factory: Gtk.SignalListItemFactory, item: Gtk.ListItem) -> None:
        path = item.get_item().get_string()
        item.get_child().bind(self._files[path], path in self._conflicts)

    # Diff pane: the selected file's header, then its lines.

    def _build_diff(self) -> Gtk.Widget:
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-sync-review-diff"])
        header = Gtk.Box(spacing=10, css_classes=["to-sync-review-diff-header"])
        self._diff_code = Text("", "code")
        self._diff_path = Text("", "code")
        self._diff_path.set_hexpand(True)
        self._diff_path.set_ellipsize(Pango.EllipsizeMode.START)
        self._diff_kind = Text("", "caption", "textSecondary")
        self._diff_added = Text("", "code", tone_foreground("success"))
        self._diff_removed = Text("", "code", tone_foreground("danger"))
        for widget in (self._diff_code, self._diff_path, self._diff_kind, self._diff_added, self._diff_removed):
            header.append(widget)
        box.append(header)

        self._lines = Gtk.StringList.new([])
        self._line_items: list[DiffLine] = []
        factory = Gtk.SignalListItemFactory()
        factory.connect("setup", lambda _f, item: item.set_child(_DiffRow()))
        factory.connect("bind", lambda _f, item: item.get_child().bind(self._line_items[item.get_position()]))
        lines = Gtk.ListView(model=Gtk.NoSelection(model=self._lines), factory=factory, css_classes=["to-sync-review-lines"])
        self._lines_scroller = Gtk.ScrolledWindow(child=lines, vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER)
        self._message = Text("", "body", "textSecondary", wrap=True, lines=None, center=True)
        self._message.set_vexpand(True)
        self._message.set_valign(Gtk.Align.CENTER)
        self._footnote = Text("", "caption", "textTertiary", center=True)
        box.append(self._lines_scroller)
        box.append(self._message)
        box.append(self._footnote)
        self._set_message(SYNC_REVIEW["select"])
        return box

    def _show(self, path: str | None) -> None:
        if path is None or path == self._shown:
            return
        self._shown = path
        change = self._files[path]
        code, tone = sync_change_code(change["kind"])
        self._diff_code.set_label(code)
        self._diff_code.set_color(tone_foreground(tone))
        self._diff_path.set_label(path)
        self._diff_path.set_tooltip_text(path)
        conflict = path in self._conflicts
        self._diff_kind.set_label(SYNC["conflict_badge"] if conflict else SYNC_REVIEW[change["kind"]])
        self._diff_kind.set_color("warning" if conflict else "textSecondary")
        self._diff_added.set_visible(False)
        self._diff_removed.set_visible(False)
        cached = self._diffs.get(path)
        if cached is not None:
            self._render(cached)
            return
        self._set_message(SYNC_REVIEW["loading"])
        self._cancel_task()
        self._task = self._ctx.call(
            lambda client: self._load(client, change),
            lambda diff: self._loaded(path, diff),
            lambda error: self._loaded(path, error),
        )

    def _load(self, client, change: SyncFileChange) -> FileDiff:
        """Runs off the main thread: the host copy from disk, the sandbox copy from the controller."""
        path = change["path"]
        size = change.get("size")
        try:
            before = read_host_file(self._root, path)
            if change["kind"] == "deleted":
                after = None
            elif size is not None and size > MAX_PREVIEW_BYTES:
                raise TooLarge(size)
            else:
                after = extract_member(client.sync_export(self._project_id, [path]), path)
        except TooLarge as error:
            return FileDiff("too_large", after_size=error.size)
        return diff_file(before, after)

    def _loaded(self, path: str, result: FileDiff | BaseException) -> None:
        self._diffs[path] = result
        if path == self._shown:
            self._render(result)

    def _render(self, result: FileDiff | BaseException) -> None:
        if isinstance(result, BaseException):
            self._set_message(SYNC_REVIEW["failed"].format(error=describe_error(result)))
            return
        if result.state != "text":
            self._set_message(_state_message(result))
            return
        self._diff_added.set_label(f"+{result.added}")
        self._diff_removed.set_label(f"−{result.removed}")
        self._diff_added.set_visible(True)
        self._diff_removed.set_visible(True)
        self._line_items = result.lines
        self._lines.splice(0, self._lines.get_n_items(), [""] * len(result.lines))
        self._lines_scroller.get_vadjustment().set_value(0)
        self._lines_scroller.set_visible(True)
        self._message.set_visible(False)
        self._footnote.set_text_value(SYNC_REVIEW["truncated"].format(count=len(result.lines)) if result.truncated else None)

    def _set_message(self, message: str) -> None:
        self._line_items = []
        self._lines.splice(0, self._lines.get_n_items(), [])
        self._lines_scroller.set_visible(False)
        self._message.set_label(message)
        self._message.set_visible(True)
        self._footnote.set_visible(False)

    def _cancel_task(self) -> None:
        if self._task is not None and not self._task.done:
            self._task.cancel()
        self._task = None


def _state_message(diff: FileDiff) -> str:
    if diff.state == "binary":
        size = lambda value: format_bytes(value) if value is not None else SYNC_REVIEW["absent"]  # noqa: E731
        return SYNC_REVIEW["binary"].format(before=size(diff.before_size), after=size(diff.after_size))
    if diff.state == "too_large":
        return SYNC_REVIEW["too_large"].format(size=format_bytes(diff.after_size))
    return SYNC_REVIEW[diff.state]


class _FileRow(Gtk.Box):
    """`M  name  dir/of/it  [Host edit]` in the file list."""

    def __init__(self) -> None:
        super().__init__(spacing=8, css_classes=["to-sync-review-file"])
        self._code = Text("", "code")
        self._name = Text("", "body")
        self._dir = Text("", "caption", "textTertiary")
        self._dir.set_hexpand(True)
        self._dir.set_ellipsize(Pango.EllipsizeMode.START)
        self._name.set_ellipsize(Pango.EllipsizeMode.MIDDLE)
        self._badge = Text(SYNC["conflict_badge"], "caption", "warning")
        for widget in (self._code, self._name, self._dir, self._badge):
            self.append(widget)

    def bind(self, change: SyncFileChange, conflict: bool) -> None:
        code, tone = sync_change_code(change["kind"])
        self._code.set_label(code)
        self._code.set_color(tone_foreground(tone))
        directory, name = posixpath.split(change["path"])
        self._name.set_label(name)
        self._dir.set_label(directory)
        self.set_tooltip_text(change["path"])
        self._badge.set_visible(conflict)


class _DiffRow(Gtk.Box):
    """One diff line: old and new line numbers in the gutter, then the text on a tinted background."""

    KINDS = ("hunk", "add", "del", "ctx", "note")

    def __init__(self) -> None:
        super().__init__(css_classes=["to-diff-line"])
        self._old = Text("", "code", "textTertiary", xalign=1.0)
        self._new = Text("", "code", "textTertiary", xalign=1.0)
        self._sign = Text("", "code")
        self._text = Text("", "code", wrap=True, lines=None)
        self._text.set_hexpand(True)
        for gutter in (self._old, self._new):
            gutter.add_css_class("to-diff-gutter")
        self._sign.add_css_class("to-diff-sign")
        for widget in (self._old, self._new, self._sign, self._text):
            self.append(widget)

    def bind(self, line: DiffLine) -> None:
        for kind in self.KINDS:
            self.remove_css_class(kind)
        self.add_css_class(line.kind)
        self._old.set_label("" if line.old is None else str(line.old))
        self._new.set_label("" if line.new is None else str(line.new))
        self._sign.set_label({"add": "+", "del": "−"}.get(line.kind, ""))
        self._text.set_label(line.text)
