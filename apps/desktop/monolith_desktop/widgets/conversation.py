from gi.repository import Adw, GLib, Gtk, Pango

from ..theme.tokens import AVATAR_SIZE
from ..theme.tone import Tone
from .avatar import Avatar
from .buttons import IconButton
from .icon import Icon
from .markdown import MarkdownView
from .motion import revealer
from .text import Text
from .tone import ToneBinding

FOLLOW_THRESHOLD_PX = 48
TIMELINE_WIDTH = 760


class PaneBar(Gtk.Box):
    """The compact bar on top of a pane: a title area that expands, then trailing actions."""

    def __init__(self) -> None:
        super().__init__(spacing=8, css_classes=["to-pane-bar"])
        self.start = Gtk.Box(spacing=6, hexpand=True, valign=Gtk.Align.CENTER)
        self.end = Gtk.Box(spacing=2, valign=Gtk.Align.CENTER)
        self.append(self.start)
        self.append(self.end)


class Placeholder(Gtk.Box):
    """A centred outline glyph over one quiet sentence, for empty panes and lists."""

    def __init__(self, title: str, icon: str | None = None, loading: bool = False) -> None:
        super().__init__(
            orientation=Gtk.Orientation.VERTICAL, spacing=16, halign=Gtk.Align.CENTER, valign=Gtk.Align.CENTER,
            vexpand=True, css_classes=["to-placeholder"],
        )
        self._spinner = Adw.Spinner(width_request=20, height_request=20, halign=Gtk.Align.CENTER)
        self._glyph = Icon(icon or "empty", "2xl", "textTertiary")
        self._glyph.add_css_class("to-placeholder-glyph")
        self._title = Text(title, "body", "textSecondary", wrap=True, lines=None, center=True)
        for widget in (self._spinner, self._glyph, self._title):
            self.append(widget)
        self.set_content(title, icon, loading)

    def set_content(self, title: str, icon: str | None = None, loading: bool = False) -> None:
        self._title.set_label(title)
        self._spinner.set_visible(loading)
        self._glyph.set_visible(icon is not None and not loading)
        if icon:
            self._glyph.set_icon(icon)


class AgentAvatar(Gtk.Box):
    def __init__(self, icon: str = "agents") -> None:
        super().__init__(halign=Gtk.Align.START, valign=Gtk.Align.CENTER, css_classes=["to-agent-avatar"])
        mark = Icon(icon, "xs")
        mark.set_size_request(AVATAR_SIZE["sm"], AVATAR_SIZE["sm"])
        self.append(mark)


class AuthorLine(Gtk.Box):
    def __init__(self, avatar: Gtk.Widget, name: str, time: str = "") -> None:
        super().__init__(spacing=8, css_classes=["to-author-line"])
        self.append(avatar)
        self.append(Text(name, "label"))
        self._time = Text(time, "caption", "textTertiary")
        self._time.set_visible(bool(time))
        self.append(self._time)

    def set_time(self, time: str) -> None:
        self._time.set_text_value(time)


class ActivityRow(Gtk.Box):
    """A quiet one-line event aligned with the avatar column: a small glyph, then 12px text."""

    def __init__(self, glyph: Gtk.Widget, *labels: Gtk.Widget) -> None:
        super().__init__(spacing=8, css_classes=["to-activity"])
        glyph.set_size_request(AVATAR_SIZE["sm"], -1)
        glyph.set_valign(Gtk.Align.CENTER)
        self.append(glyph)
        for label in labels:
            self.append(label)


class UserBubble(Gtk.Box):
    def __init__(self, text: str, attachments: list[Gtk.Widget] | None = None, author: str = "", time: str = "") -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=6, css_classes=["to-user-message"])
        self._author = AuthorLine(Avatar(author, AVATAR_SIZE["sm"]), author, time)
        self.append(self._author)
        self._label = Text(text, "body", wrap=True, lines=None, selectable=True)
        self._label.set_focusable(False)
        self._label.add_css_class("to-message-body")
        self.append(self._label)
        if attachments:
            row = Gtk.FlowBox(
                selection_mode=Gtk.SelectionMode.NONE, column_spacing=6, row_spacing=6, max_children_per_line=4,
                halign=Gtk.Align.START, homogeneous=False, css_classes=["to-message-body"],
            )
            for chip in attachments:
                row.append(Gtk.FlowBoxChild(child=chip, focusable=False))
            self.append(row)

    def set_text(self, text: str) -> None:
        self._label.set_label(text)

    def set_time(self, time: str) -> None:
        self._author.set_time(time)


class AssistantMessage(Gtk.Box):
    def __init__(
        self,
        text: str,
        author: str | None = None,
        icon: str = "agents",
        copy_label: str = "Copy",
        copied_label: str = "Copied",
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=6, css_classes=["to-assistant-message"])
        if author:
            self.append(AuthorLine(AgentAvatar(icon), author))
        self._body = MarkdownView(text, copy_label=copy_label, copied_label=copied_label)
        self._body.set_hexpand(True)
        self._body.add_css_class("to-message-body")
        self.append(self._body)

    def set_text(self, text: str) -> None:
        self._body.set_markdown(text)


class ToolCallCard(Gtk.Box):
    def __init__(self, tool: str, summary: str, result: str | None, status: str, labels: dict[str, str]) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-tool-card"])
        self._labels = labels
        header = Gtk.Button(css_classes=["flat", "to-tool-header"])
        self._status = Gtk.Stack(hhomogeneous=False, vhomogeneous=False)
        self._status.add_named(Adw.Spinner(width_request=12, height_request=12), "pending")
        self._status.add_named(Icon("tool", "xs", "textTertiary"), "ok")
        self._status.add_named(Icon("failed", "xs", "danger"), "error")
        self._status.add_named(Icon("tool", "xs", "textTertiary"), "unknown")
        self._name = Text(tool, "overline", "textSecondary")
        self._summary = Text(summary, "caption", "textTertiary")
        self._summary.set_hexpand(True)
        self._summary.set_ellipsize(Pango.EllipsizeMode.END)
        self._chevron = Icon("collapse", "xs", "textTertiary")
        self._chevron.add_css_class("to-tool-chevron")
        header.set_child(ActivityRow(self._status, self._name, self._summary, self._chevron))
        header.connect("clicked", lambda *_: self.set_expanded(not self._revealer.get_reveal_child()))
        self.append(header)

        details = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, css_classes=["to-tool-details"])
        self._input_title = Text(labels["input"], "caption", "textTertiary")
        self._input = Text("", "code", "text", wrap=True, lines=None, selectable=True)
        self._result_title = Text(labels["output"], "caption", "textTertiary")
        self._result = Text("", "code", "textSecondary", wrap=True, lines=None, selectable=True)
        for widget in (self._input_title, self._input, self._result_title, self._result):
            widget.set_focusable(False)
            details.append(widget)
        self._revealer = revealer(child=details, transition_type=Gtk.RevealerTransitionType.SLIDE_DOWN)
        self.append(self._revealer)
        self.update(tool, summary, result, status)

    def set_expanded(self, expanded: bool) -> None:
        self._revealer.set_reveal_child(expanded)
        self._chevron.set_icon("expand" if expanded else "collapse")

    def update(self, tool: str, summary: str, result: str | None, status: str) -> None:
        self._name.set_text_value(tool)
        self._summary.set_label((summary or result or "").splitlines()[0] if (summary or result) else "")
        self._input.set_label(summary)
        self._input.set_visible(bool(summary))
        self._input_title.set_visible(bool(summary))
        self._result.set_label(result or "")
        self._result.set_visible(bool(result))
        self._result_title.set_visible(bool(result))
        self._result.set_color("danger" if status == "error" else "textSecondary")
        self._status.set_visible_child_name(status if status in ("pending", "ok", "error") else "unknown")
        if status == "error":
            self.add_css_class("error")
        else:
            self.remove_css_class("error")


class SystemLine(ActivityRow):
    def __init__(self, text: str) -> None:
        self._label = Text(text, "caption", "textTertiary", wrap=True, lines=None, selectable=True)
        self._label.set_focusable(False)
        self._label.set_hexpand(True)
        super().__init__(Icon("info", "xs", "textTertiary"), self._label)
        self.add_css_class("to-system")

    def set_text(self, text: str) -> None:
        self._label.set_label(text)


class OutcomeCard(Gtk.Box):
    def __init__(self, title: str, meta: str | None, tone: Tone, icon: str, body: str | None = None, error: str | None = None) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=6, css_classes=["to-outcome"])
        self._icon = Icon(icon, "xs")
        self._icon.add_css_class("to-tone-fg")
        self._title = Text(title, "overline")
        self._title.add_css_class("to-tone-fg")
        self._meta = Text(meta or "", "caption", "textTertiary")
        self._meta.set_hexpand(True)
        self.append(ActivityRow(self._icon, self._title, self._meta))
        self._error = Text("", "bodySmall", "danger", wrap=True, lines=None, selectable=True)
        self._error.set_focusable(False)
        self._error.add_css_class("to-message-body")
        self.append(self._error)
        self._body = MarkdownView("")
        self._body.add_css_class("to-message-body")
        self.append(self._body)
        self._tone = ToneBinding(tone, self._icon, self._title)
        self.update(title, meta, tone, icon, body, error)

    def update(self, title: str, meta: str | None, tone: Tone, icon: str, body: str | None = None, error: str | None = None) -> None:
        self._title.set_label(title)
        self._meta.set_text_value(meta)
        self._tone.set(tone)
        self._icon.set_icon(icon)
        self._error.set_text_value(error)
        self._body.set_markdown(body or "")
        self._body.set_visible(bool(body))


class ThinkingRow(ActivityRow):
    def __init__(self, label: str) -> None:
        super().__init__(Adw.Spinner(width_request=12, height_request=12), Text(label, "caption", "textSecondary"))
        self.add_css_class("to-thinking")


class TimelineView(Gtk.Overlay):
    def __init__(self, jump_label: str, max_width: int = TIMELINE_WIDTH) -> None:
        super().__init__(vexpand=True, hexpand=True, css_classes=["to-timeline"])
        self._following = True
        self._header = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self._items = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        self._footer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, css_classes=["to-timeline-content"])
        for part in (self._header, self._items, self._footer):
            content.append(part)
        clamp = Adw.Clamp(maximum_size=max_width, tightening_threshold=max_width, child=content)
        self._scroller = Gtk.ScrolledWindow(child=clamp, hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True)
        self.set_child(self._scroller)
        self._jump = IconButton("down", jump_label, self.jump_to_end, flat=False)
        self._jump.add_css_class("to-jump-button")
        self._jump.set_halign(Gtk.Align.CENTER)
        self._jump.set_valign(Gtk.Align.END)
        self._jump.set_margin_bottom(16)
        self._jump.set_visible(False)
        self.add_overlay(self._jump)
        adjustment = self._scroller.get_vadjustment()
        adjustment.connect("value-changed", self._on_scroll)
        adjustment.connect("changed", self._on_content_changed)

    def append(self, widget: Gtk.Widget) -> None:
        self._items.append(widget)

    def clear(self) -> None:
        while (child := self._items.get_first_child()) is not None:
            self._items.remove(child)
        self._following = True
        self._jump.set_visible(False)

    def set_header(self, widget: Gtk.Widget | None) -> None:
        _replace_children(self._header, widget)

    def set_footer(self, widgets: list[Gtk.Widget]) -> None:
        _replace_children(self._footer, None)
        for widget in widgets:
            self._footer.append(widget)

    def jump_to_end(self) -> None:
        self._following = True
        self._jump.set_visible(False)
        GLib.idle_add(self._scroll_to_end)

    def _scroll_to_end(self) -> bool:
        adjustment = self._scroller.get_vadjustment()
        adjustment.set_value(adjustment.get_upper() - adjustment.get_page_size())
        return GLib.SOURCE_REMOVE

    def _on_scroll(self, adjustment: Gtk.Adjustment) -> None:
        distance = adjustment.get_upper() - adjustment.get_page_size() - adjustment.get_value()
        self._following = distance <= FOLLOW_THRESHOLD_PX
        self._jump.set_visible(not self._following)

    def _on_content_changed(self, adjustment: Gtk.Adjustment) -> None:
        if self._following:
            GLib.idle_add(self._scroll_to_end)
        else:
            self._on_scroll(adjustment)


def _replace_children(box: Gtk.Box, widget: Gtk.Widget | None) -> None:
    while (child := box.get_first_child()) is not None:
        box.remove(child)
    if widget is not None:
        box.append(widget)
