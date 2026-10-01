from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import Adw, Gtk

from ...api.client import ControllerClient
from ...api.errors import describe_error
from ...api.types import SyncFileChange, SyncRequest
from ...syncback.state import Snapshot
from ...syncback.summary import describe_result, plural
from ...util.format import format_bytes, format_relative_time
from ...widgets.buttons import ActionButton
from ...widgets.confirm_dialog import confirm
from ...widgets.feedback import Notice
from ...widgets.keyed_list import KeyedList
from ...widgets.lifecycle import while_mapped
from ...widgets.record_row import RecordRow, RowAction
from ...widgets.rows import KeyValueList
from ...widgets.section import Section
from ...widgets.surface import Surface
from .labels import SYNC, SYNC_KINDS
from .model import SyncView, listed_paths, load_sync_view, sync_change_code, sync_request_state

if TYPE_CHECKING:
    from .detail import ProjectDetail

TAB_SPACING = 28
REFRESH_INTERVAL_S = 15.0


class SyncTab:
    def __init__(self, host: "ProjectDetail", on_count: Callable[[int], None]) -> None:
        self._host = host
        self._service = host.ctx.syncback
        self._on_count = on_count
        self._view = SyncView()
        self._loaded_once = False
        self.widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=TAB_SPACING)

        self._notice = Notice("", tone="neutral")
        self._notice.set_visible(False)
        self.widget.append(self._notice)

        self._summary = KeyValueList()
        self._summary_card = Surface(compact=True)
        self._summary_card.append(self._summary)
        self.widget.append(self._summary_card)

        self._changes = KeyedList(lambda: RecordRow(None, monospace_title=True), self._update_change)
        self._changes_section = Section(SYNC["changes"], self._changes, empty_label=SYNC["changes_empty"])
        actions = Adw.WrapBox(child_spacing=8, line_spacing=8)
        self._sync_button = ActionButton(SYNC["sync"], self._confirm_sync, "primary", "down")
        self._revert_button = ActionButton(SYNC["revert"], self._confirm_revert, "secondary", "back")
        actions.append(self._sync_button)
        actions.append(self._revert_button)
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

        self._poller = host.ctx.poll(self._fetch, REFRESH_INTERVAL_S, self._loaded, self._failed).bind(host.widget)
        while_mapped(host.widget, self._attach)
        self._render()

    def refresh(self) -> None:
        self._poller.refresh()

    def _attach(self) -> Callable[[], None]:
        detach = [
            self._service.revision.subscribe(lambda _r: self._poller.refresh(), immediate=False),
            self._service.busy.subscribe(lambda _b: self._render_actions(), immediate=False),
        ]
        return lambda: [unsubscribe() for unsubscribe in detach]

    def _fetch(self, client: ControllerClient) -> SyncView:
        return load_sync_view(client, self._service.state, self._host.project_id)

    def _loaded(self, view: SyncView) -> None:
        self._view = view
        self._loaded_once = True
        self._render()

    def _failed(self, error: BaseException) -> None:
        self._host.report(error)

    def _render(self) -> None:
        view = self._view
        linked = view.link is not None
        self._summary_card.set_visible(linked)
        self._changes_section.set_visible(linked)
        self._requests_section.set_visible(linked)
        self._snapshots_section.set_visible(linked or bool(view.snapshots))
        self._render_notice()
        self._render_actions()
        self._on_count(len(view.files))
        self._snapshots.sync((snapshot.id, snapshot) for snapshot in view.snapshots)
        self._snapshots_section.set_empty(not view.snapshots)
        if not linked:
            return
        changes = view.changes
        self._summary.set_rows([
            (SYNC["host_path"], view.link.host_path),
            (SYNC["pushed"], format_relative_time(view.link.pushed_at) if view.link.pushed_at else "—"),
            (SYNC["baseline"], format_relative_time(changes.get("baselineAt")) if changes and changes.get("baselineAt") else "—"),
        ])
        if not self._loaded_once or (changes is None and view.error is None):
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

    def _render_actions(self) -> None:
        view = self._view
        idle = self._host.project_id not in self._service.busy.value and not view.in_flight
        self._sync_button.set_sensitive(idle and view.link is not None and bool(view.files))
        self._revert_button.set_sensitive(idle and view.link is not None and view.revertible is not None)

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

    def _confirm_sync(self) -> None:
        view = self._view
        if view.link is None or not view.files:
            return
        paths = [change["path"] for change in view.files]
        conflicts = [path for path in paths if path in view.conflicts]
        body = SYNC["confirm_body"].format(files=listed_paths(paths))
        if conflicts:
            body = SYNC["confirm_conflicts"].format(count=plural(len(conflicts), "file")) + body
        confirm(
            self._host.ctx.window,
            SYNC["confirm_title"].format(count=plural(len(paths), "file"), path=view.link.host_path),
            body,
            SYNC["confirm_force"] if conflicts else SYNC["confirm"],
            SYNC["cancel"],
            lambda: self._submit("pull", bool(conflicts), paths),
            destructive=bool(conflicts),
        )

    def _confirm_revert(self) -> None:
        snapshot = self._view.revertible
        if snapshot is None:
            return
        confirm(
            self._host.ctx.window,
            SYNC["revert_title"].format(id=snapshot.id),
            SYNC["revert_body"].format(count=plural(len(snapshot.entries), "file")) + "\n\n" + listed_paths([e.path for e in snapshot.entries]),
            SYNC["revert_confirm"],
            SYNC["cancel"],
            lambda: self._submit("revert", False, None),
        )

    def _submit(self, kind: str, force: bool, paths: list[str] | None) -> None:
        self._sync_button.set_sensitive(False)
        self._revert_button.set_sensitive(False)
        self._service.submit(self._host.project_id, kind, force, paths, on_error=self._submit_failed)
        self._host.ctx.toast(SYNC["queued"])

    def _submit_failed(self, error: BaseException) -> None:
        self._host.report(error)
        self._render_actions()

    def _cancel(self, request: SyncRequest) -> None:
        self._host.ctx.call(lambda client: client.cancel_sync_request(request["id"]), lambda _r: self.refresh(), self._host.report)
