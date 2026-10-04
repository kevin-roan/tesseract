from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import Adw, Gtk

from ...api.errors import describe_error
from ...api.types import SyncFileChange, SyncRequest
from ...syncback.state import Snapshot
from ...syncback.summary import describe_result, plural
from ...theme.tone import Tone
from ...util.format import format_bytes, format_relative_time
from ...widgets.feedback import Notice
from ...widgets.keyed_list import KeyedList
from ...widgets.record_row import RecordRow, RowAction
from ...widgets.rows import KeyValueList
from ...widgets.section import Section
from ...widgets.surface import Surface
from .labels import SYNC, SYNC_KINDS
from .model import SyncView, sync_change_code, sync_request_state
from .sync_actions import SyncActions

if TYPE_CHECKING:
    from .detail import ProjectDetail

TAB_SPACING = 28


class SyncTab:
    def __init__(self, host: "ProjectDetail", on_count: Callable[[int], None]) -> None:
        self._host = host
        self._on_count = on_count
        self._view = SyncView()
        self.widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=TAB_SPACING)

        self._notice = Notice("", tone="neutral")
        self._notice.set_visible(False)
        self.widget.append(self._notice)

        self._result = Notice("", tone="neutral", action_label=SYNC["dismiss"], on_action=lambda: self._result.set_visible(False))
        self._result.set_visible(False)
        self.widget.append(self._result)

        self._summary = KeyValueList()
        self._summary_card = Surface(compact=True)
        self._summary_card.append(self._summary)
        self.widget.append(self._summary_card)

        self._changes = KeyedList(lambda: RecordRow(None, monospace_title=True), self._update_change)
        self._changes_section = Section(SYNC["changes"], self._changes, empty_label=SYNC["changes_empty"])
        self._actions = SyncActions(
            host.ctx, host.widget, host.project_id, on_view=self._loaded, on_report=self._show_result, on_error=host.report
        )
        actions = Adw.WrapBox(child_spacing=8, line_spacing=8)
        for button in self._actions.buttons.values():
            actions.append(button)
        self._changes_section.header.add_trailing(actions)
        self.widget.append(self._changes_section)

        self._requests = KeyedList(lambda: RecordRow("host"), self._update_request)
        self._requests_section = Section(SYNC["requests"], self._requests, empty_label=SYNC["requests_empty"])
        self.widget.append(self._requests_section)

        self._snapshots = KeyedList(lambda: RecordRow("sessions", monospace_title=True), self._update_snapshot)
        self._snapshots_section = Section(
            SYNC["snapshots"], self._snapshots, empty_label=SYNC["snapshots_empty"], subtitle=SYNC["snapshots_subtitle"]
        )
        self.widget.append(self._snapshots_section)

        self._render()

    def refresh(self) -> None:
        self._actions.refresh()

    def _loaded(self, view: SyncView) -> None:
        self._view = view
        self._render()

    def _show_result(self, message: str, tone: Tone) -> None:
        self._result.update(message, tone=tone)
        self._result.set_visible(True)

    def _render(self) -> None:
        view = self._view
        linked = view.link is not None
        self._summary_card.set_visible(linked)
        self._changes_section.set_visible(linked or bool(view.files))
        self._requests_section.set_visible(linked or bool(view.requests))
        self._snapshots_section.set_visible(linked or bool(view.snapshots))
        self._render_notice()
        self._on_count(len(view.files))
        self._snapshots.sync((snapshot.id, snapshot) for snapshot in view.snapshots)
        self._snapshots_section.set_empty(not view.snapshots)
        changes = view.changes
        if linked:
            self._summary.set_rows([
                (SYNC["host_path"], view.link.host_path),
                (SYNC["pushed"], format_relative_time(view.link.pushed_at) if view.link.pushed_at else "—"),
                (SYNC["got"], format_relative_time(view.link.got_at) if view.link.got_at else "—"),
                (SYNC["baseline"], format_relative_time(changes.get("baselineAt")) if changes and changes.get("baselineAt") else "—"),
            ])
        if not self._actions.loaded or (changes is None and view.error is None):
            self._changes_section.set_loading(True)
            return
        self._changes_section.set_loading(False)
        files = view.files
        self._changes_section.header.set_subtitle(
            SYNC["changes_subtitle"].format(count=plural(len(files), "file"), size=format_bytes(changes.get("totalBytes", 0)))
            if changes and files else None
        )
        self._changes.sync((change["path"], change) for change in files)
        self._changes_section.set_empty(not files)
        self._requests.sync((request["id"], request) for request in view.requests[:10])
        self._requests_section.set_empty(not view.requests)

    def _render_notice(self) -> None:
        view = self._view
        message, tone = None, "neutral"
        if view.link is None:
            message = SYNC["not_linked"]
        elif view.error is not None:
            message, tone = SYNC["error"].format(error=describe_error(view.error)), "warning"
        elif view.changes is not None and view.changes.get("baselineAt") is None:
            message = SYNC["never_pushed"].format(path=view.link.host_path)
        self._notice.set_visible(message is not None)
        if message:
            self._notice.update(message, tone=tone)

    def _update_change(self, row: RecordRow, change: SyncFileChange) -> None:
        row.set_code(*sync_change_code(change["kind"]))
        conflict = change["path"] in self._view.conflicts
        size = format_bytes(change["size"]) if change.get("size") is not None else None
        row.set_content(change["path"], None, SYNC["conflict"] if conflict else size)
        row.set_status(SYNC["conflict_badge"] if conflict else None, "warning")

    def _update_snapshot(self, row: RecordRow, snapshot: Snapshot) -> None:
        row.set_content(
            snapshot.id, None,
            SYNC["snapshot_meta"].format(files=plural(len(snapshot.entries), "file"), when=format_relative_time(snapshot.createdAt)),
        )
        row.set_status(SYNC["reverted"] if snapshot.reverted else None, "neutral")

    def _update_request(self, row: RecordRow, request: SyncRequest) -> None:
        label, tone = sync_request_state(request["status"])
        result = request.get("result")
        detail = request.get("error") or (describe_result(request["kind"], dict(result)) if result and request["status"] == "applied" else None)
        row.set_content(
            SYNC_KINDS.get(request["kind"], request["kind"]),
            detail,
            SYNC["request_meta"].format(source=request.get("source", ""), when=format_relative_time(request["createdAt"])),
        )
        row.set_status(label, tone)
        actions = []
        if request["status"] == "pending":
            actions.append(RowAction("cancel", "stop", SYNC["cancel"], lambda: self._cancel(request), destructive=True))
        row.set_actions(actions)

    def _cancel(self, request: SyncRequest) -> None:
        self._host.ctx.call(lambda client: client.cancel_sync_request(request["id"]), lambda _r: self.refresh(), self._host.report)
