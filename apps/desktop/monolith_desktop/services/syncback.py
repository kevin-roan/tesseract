import logging
import socket
from collections.abc import Callable
from typing import Any

from gi.repository import Gio, GLib

from ..api.client import ControllerClient
from ..api.errors import ApiError, describe_error
from ..api.tasks import run_async
from ..api.types import SyncRequest
from ..store import AppStore, ConnectionState, Observable
from ..strings import SYNC_BACK
from ..syncback.requests import Handled, claimable, handle_request
from ..syncback.state import SyncState

log = logging.getLogger(__name__)

HEARTBEAT_INTERVAL_S = 20


class SyncBackService:
    """Applies sync-back requests for projects linked on this host.

    Sends a heartbeat every 20 s, polls pending requests (and reacts to sync.updated),
    claims those for linked projects and applies them one at a time off the UI thread.
    `revision` bumps whenever a request finished or a request/baseline changed, so views can refresh.
    """

    def __init__(self, app: Any, store: AppStore, client: Callable[[], ControllerClient], events: Any, state: SyncState | None = None) -> None:
        self.app = app
        self.store = store
        self.state = state or SyncState()
        self.host = socket.gethostname()
        self.revision: Observable[int] = Observable(0)
        self.busy: Observable[frozenset[str]] = Observable(frozenset())
        self._client = client
        self._queue: list[SyncRequest] = []
        self._seen: set[str] = set()
        self._active = False
        self._timer: int | None = None
        events.subscribe("sync.updated", self._request_event)
        events.subscribe("sync.changed", lambda _m: self._bump())
        events.subscribe("hello", lambda _m: self.tick())
        store.connection.subscribe(self._connection_changed)

    def stop(self) -> None:
        if self._timer is not None:
            GLib.source_remove(self._timer)
            self._timer = None

    def tick(self) -> None:
        if self.store.connection.value.online:
            run_async(self._beat, on_success=self._enqueue_all, on_error=lambda e: log.debug("sync heartbeat failed: %s", describe_error(e)))

    def submit(
        self,
        project_id: str,
        kind: str,
        force: bool = False,
        paths: list[str] | None = None,
        on_error: Callable[[BaseException], None] | None = None,
    ) -> None:
        def created(request: SyncRequest) -> None:
            self._bump()
            self._enqueue(request)

        run_async(
            lambda: self._client().create_sync_request(project_id, kind, paths, force, "desktop"),  # type: ignore[arg-type]
            on_success=created,
            on_error=on_error,
        )

    def _beat(self) -> list[SyncRequest]:
        client = self._client()
        linked = list(self.state.links())
        client.sync_heartbeat(self.host, linked)
        return client.pending_sync_requests() if linked else []

    def _connection_changed(self, state: ConnectionState) -> None:
        if state.online and self._timer is None:
            self._timer = GLib.timeout_add_seconds(HEARTBEAT_INTERVAL_S, self._on_timer)
            self.tick()
        elif not state.online:
            self.stop()

    def _on_timer(self) -> bool:
        self.tick()
        return GLib.SOURCE_CONTINUE

    def _request_event(self, message: dict[str, Any]) -> None:
        request = message.get("request")
        if isinstance(request, dict):
            self._bump()
            self._enqueue(request)  # type: ignore[arg-type]

    def _enqueue_all(self, requests: list[SyncRequest]) -> None:
        for request in reversed(requests or []):
            self._enqueue(request)

    def _enqueue(self, request: SyncRequest) -> None:
        if request.get("id") in self._seen or not claimable(dict(request), self.state):
            return
        self._seen.add(request["id"])
        self._queue.append(request)
        self._drain()

    def _drain(self) -> None:
        if self._active or not self._queue:
            return
        request = self._queue.pop(0)
        self._active = True
        self.busy.set(self.busy.value | {request["projectId"]})

        def done() -> None:
            self._active = False
            self.busy.set(self.busy.value - {request["projectId"]})
            self._bump()
            self._drain()

        run_async(
            lambda: handle_request(self._client(), self.state, dict(request), self.host),
            on_success=self._handled,
            on_error=lambda error: self._failed(request, error),
            on_done=done,
        )

    def _handled(self, handled: Handled) -> None:
        request = handled.request
        kind = "revert" if request.get("kind") == "revert" else "pull"
        title = SYNC_BACK[f"{kind}_{'done' if handled.ok else 'failed'}"].format(project=request.get("projectId"))
        self._notify(request.get("projectId", ""), title, handled.message)

    def _failed(self, request: SyncRequest, error: BaseException) -> None:
        if isinstance(error, ApiError) and error.status == 409:
            log.debug("sync request %s was taken or cancelled: %s", request["id"], error)
            return
        if not isinstance(error, ApiError):
            self._seen.discard(request["id"])
        kind = "revert" if request.get("kind") == "revert" else "pull"
        title = SYNC_BACK[f"{kind}_failed"].format(project=request.get("projectId"))
        self._notify(request.get("projectId", ""), title, describe_error(error))

    def _notify(self, project_id: str, title: str, body: str) -> None:
        notification = Gio.Notification.new(title)
        notification.set_body(body)
        notification.set_default_action_and_target("app.navigate", GLib.Variant("s", "projects"))
        try:
            self.app.send_notification(f"sync-{project_id}", notification)
        except Exception:  # noqa: BLE001
            log.debug("could not send a notification", exc_info=True)

    def _bump(self) -> None:
        self.revision.set(self.revision.value + 1)
