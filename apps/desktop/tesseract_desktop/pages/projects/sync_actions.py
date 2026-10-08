from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import Gtk

from ...api.client import ControllerClient
from ...api.errors import describe_error
from ...api.types import SyncDiscardResult
from ...syncback.manifest import DigestCache
from ...syncback.summary import plural
from ...theme.tone import Tone
from ...widgets.buttons import ActionButton
from ...widgets.confirm_dialog import confirm
from ...widgets.lifecycle import while_mapped
from .labels import SYNC, SYNC_HINTS
from .model import SyncView, discard_summary, listed_paths, load_sync_view, sync_blockers, sync_waiting
from .sync_review import SyncReviewDialog

if TYPE_CHECKING:
    from ...context import AppContext


class SyncActions:
    """Sync to host / Sync from host / Revert / Discard for one project, with the sync view they act on.

    Polls the project's `SyncView` while `anchor` is mapped (and on every sync-back revision) and keeps
    each button disabled, with the reason as its tooltip, while its action can't run. Sync to host and Sync from
    host stand out while their direction has changes waiting.
    """

    def __init__(
        self,
        ctx: "AppContext",
        anchor: Gtk.Widget,
        project_id: str | None = None,
        on_view: Callable[[SyncView], None] | None = None,
        on_report: Callable[[str, Tone], None] | None = None,
        on_error: Callable[[BaseException], None] | None = None,
        on_activate: Callable[[], None] | None = None,
        interval_s: float = 15.0,
    ) -> None:
        self._ctx = ctx
        self._service = ctx.syncback
        self._project_id = project_id
        self._on_view = on_view
        self._on_report = on_report
        self._on_error = on_error
        self._on_activate = on_activate
        self._pending = False
        self.view = SyncView()
        self.loaded = False
        self._digests = DigestCache()
        self.buttons = {
            "pull": ActionButton(SYNC["sync"], lambda: self._activate(self._confirm_pull), "primary", "sync-to-host"),
            "get": ActionButton(SYNC["get"], lambda: self._activate(self._confirm_get), "secondary", "sync-from-host"),
            "revert": ActionButton(SYNC["revert"], lambda: self._activate(self._confirm_revert), "secondary", "revert"),
            "discard": ActionButton(SYNC["discard"], lambda: self._activate(self._confirm_discard), "destructive", "delete"),
        }
        self._poller = ctx.poll(self._fetch, interval_s, self._loaded, self._failed).bind(anchor)
        while_mapped(anchor, self._attach)
        self.render()

    @property
    def project_id(self) -> str | None:
        return self._project_id

    def set_project(self, project_id: str | None) -> None:
        if project_id == self._project_id:
            return
        self._project_id = project_id
        self.view = SyncView()
        self.loaded = False
        self._digests = DigestCache()
        self.render()
        if self._on_view:
            self._on_view(self.view)
        self.refresh()

    def refresh(self) -> None:
        self._poller.refresh()

    def can_run(self, kind: str) -> bool:
        return self.buttons[kind].get_sensitive()

    def discard(self) -> None:
        self._activate(self._confirm_discard)

    def render(self) -> None:
        project_id = self._project_id
        busy = project_id in self._service.busy.value
        blockers = sync_blockers(self.view, busy)
        waiting = sync_waiting(self.view)
        for kind, button in self.buttons.items():
            reason = blockers[kind]
            sensitive = project_id is not None and reason is None and not self._pending
            button.set_sensitive(sensitive)
            button.set_tooltip_text(reason or SYNC_HINTS[kind])
            if sensitive and waiting.get(kind, False):
                button.add_css_class("to-attention")
            else:
                button.remove_css_class("to-attention")

    def _attach(self) -> Callable[[], None]:
        detach = [
            self._service.revision.subscribe(lambda _r: self.refresh(), immediate=False),
            self._service.busy.subscribe(lambda _b: self.render(), immediate=False),
        ]
        return lambda: [unsubscribe() for unsubscribe in detach]

    def _fetch(self, client: ControllerClient) -> tuple[str | None, SyncView]:
        project_id = self._project_id
        if project_id is None:
            return None, SyncView()
        return project_id, load_sync_view(client, self._service.state, project_id, self._digests)

    def _loaded(self, loaded: tuple[str | None, SyncView]) -> None:
        project_id, view = loaded
        if project_id != self._project_id:
            self.refresh()
            return
        self.view = view
        self.loaded = project_id is not None
        self.render()
        if self._on_view:
            self._on_view(view)

    def _failed(self, error: BaseException) -> None:
        if self._on_error:
            self._on_error(error)

    def _activate(self, action: Callable[[], None]) -> None:
        if self._on_activate:
            self._on_activate()
        action()

    def _report(self, message: str, tone: Tone) -> None:
        if self._on_report:
            self._on_report(message, tone)
        else:
            self._ctx.toast(message.split("\n", 1)[0])

    def _confirm_pull(self) -> None:
        project_id, view = self._project_id, self.view
        if project_id is None or view.link is None or not view.files:
            return
        SyncReviewDialog(
            self._ctx, project_id, view, lambda force, paths: self._submit("pull", force, paths)
        ).present(self._ctx.window)

    def _confirm_get(self) -> None:
        view = self.view
        if view.link is None:
            return
        conflicts = view.get_conflicts
        if not conflicts:
            self._submit("get", False, None)
            return
        path = view.link.host_path
        confirm(
            self._ctx.window,
            SYNC["get_title"].format(path=path),
            SYNC["get_body"].format(path=path) + "\n\n"
            + SYNC["get_conflicts"].format(count=plural(len(conflicts), "file"), files=listed_paths(conflicts)),
            SYNC["get_force"],
            SYNC["cancel"],
            lambda: self._submit("get", True, None),
        )

    def _confirm_revert(self) -> None:
        snapshot = self.view.revertible
        if snapshot is None:
            return
        confirm(
            self._ctx.window,
            SYNC["revert_title"].format(id=snapshot.id),
            SYNC["revert_body"].format(count=plural(len(snapshot.entries), "file")) + "\n\n" + listed_paths([e.path for e in snapshot.entries]),
            SYNC["revert_confirm"],
            SYNC["cancel"],
            lambda: self._submit("revert", False, None),
        )

    def _confirm_discard(self) -> None:
        project_id, view = self._project_id, self.view
        paths = [change["path"] for change in view.discardable]
        if project_id is None or not paths:
            return
        skipped = len(view.files) - len(paths)
        body = SYNC["discard_body"].format(files=listed_paths(paths))
        if skipped:
            body += SYNC["discard_skipped"].format(count=plural(skipped, "file"))
        confirm(
            self._ctx.window,
            SYNC["discard_title"].format(count=plural(len(paths), "file")),
            body,
            SYNC["discard_confirm"],
            SYNC["cancel"],
            lambda: self._discard(project_id, paths),
        )

    def _set_pending(self, pending: bool) -> None:
        self._pending = pending
        self.render()

    def _submit(self, kind: str, force: bool, paths: list[str] | None) -> None:
        project_id = self._project_id
        if project_id is None:
            return
        self._set_pending(True)

        def failed(error: BaseException) -> None:
            self._set_pending(False)
            if self._on_error:
                self._on_error(error)
            else:
                self._report(describe_error(error), "danger")

        def created() -> None:
            self._set_pending(False)

        self._service.submit(project_id, kind, force, paths, on_error=failed, on_success=lambda _r: created())
        self._ctx.toast(SYNC[f"queued_{kind}"])

    def _discard(self, project_id: str, paths: list[str]) -> None:
        self._set_pending(True)

        def done(result: SyncDiscardResult) -> None:
            self._report(*discard_summary(result))

        def failed(error: BaseException) -> None:
            self._report(SYNC["discard_failed"].format(error=describe_error(error)), "danger")

        def finished() -> None:
            self._set_pending(False)
            self.refresh()

        self._ctx.call(lambda client: client.sync_discard(project_id, paths), done, failed, finished)
