import logging
import time
from collections.abc import Callable

from ..api.client import ControllerClient
from ..api.errors import (
    ControllerError,
    NotConfigured,
    ProtocolVersionError,
    describe_error,
    is_auth_error,
)
from ..api.events import EventStream
from ..api.tasks import Task, run_async
from ..api.types import Health, SandboxStatus
from ..config.discovery import DiscoveryError, DiscoveryResult, discover_docker, initial_config
from ..config.model import ConnectionConfig
from ..config.storage import clear_file_config, save_file_config
from ..poller import Poller
from ..store import AppStore, ConnectionState

log = logging.getLogger(__name__)

STATUS_INTERVAL_S = 5.0
STATUS_INTERVAL_HIDDEN_S = 30.0
INBOX_LIMIT = 1


class ConnectionService:
    def __init__(self, store: AppStore) -> None:
        self.store = store
        self._client: ControllerClient | None = None
        self._discovery: Task | None = None
        self.events = EventStream(lambda: self._client, on_state=self._events_state, on_error=self._events_error)
        self._poller: Poller[tuple[Health, SandboxStatus]] = Poller(
            self._check, STATUS_INTERVAL_S, self._checked, self._check_failed
        )
        self.events.subscribe("inbox.updated", self._inbox_event)
        self.events.subscribe("hello", lambda _m: self._refresh_inbox())
        store.window_visible.subscribe(self._visibility_changed, immediate=False)

    @property
    def client(self) -> ControllerClient | None:
        return self._client

    @property
    def config(self) -> ConnectionConfig | None:
        return self.store.connection.value.config

    def require_client(self) -> ControllerClient:
        if self._client is None:
            raise NotConfigured()
        return self._client

    def start(self) -> None:
        config = initial_config()
        if config:
            self.connect(config)
        else:
            self.rediscover()

    def stop(self) -> None:
        self._poller.stop()
        self.events.stop()
        if self._discovery:
            self._discovery.cancel()

    def connect(self, config: ConnectionConfig) -> None:
        self._poller.stop()
        self.events.stop()
        try:
            self._client = ControllerClient(config.api_url, config.token)
        except ValueError as error:
            self._client = None
            self._set(ConnectionState("offline", config, None, error, str(error), time.time()))
            return
        self._set(ConnectionState("connecting", config))
        self.store.status.set(None)
        self._poller.start()

    def refresh(self) -> None:
        if self._client is not None:
            self._poller.refresh()

    def save(self, config: ConnectionConfig) -> None:
        save_file_config(config)
        self.connect(config.with_(source="file"))

    def forget(self) -> None:
        clear_file_config()
        self.rediscover()

    def rediscover(self, on_done: Callable[[DiscoveryResult | None, BaseException | None], None] | None = None) -> None:
        if self._discovery and not self._discovery.done:
            self._discovery.cancel()
        previous = self.store.connection.value
        self._set(previous.with_(status="discovering", error=None, error_message=None))

        def success(result: DiscoveryResult) -> None:
            if result.config:
                self.connect(result.config)
            if on_done:
                on_done(result, None)

        def failure(error: BaseException) -> None:
            message = str(error) if isinstance(error, DiscoveryError) else describe_error(error)
            state = previous if previous.config else ConnectionState("unconfigured")
            if previous.config:
                self.connect(previous.config)
            else:
                self._set(state.with_(error=error, error_message=message, checked_at=time.time()))
            if on_done:
                on_done(None, error)

        self._discovery = run_async(discover_docker, on_success=success, on_error=failure)

    def _set(self, state: ConnectionState) -> None:
        self.store.connection.set(state)

    def _check(self) -> tuple[Health, SandboxStatus]:
        client = self.require_client()
        return client.health(), client.status()

    def _checked(self, result: tuple[Health, SandboxStatus]) -> None:
        health, status = result
        state = self.store.connection.value
        was_online = state.online
        self._set(state.with_(status="online", health=health, error=None, error_message=None, checked_at=time.time()))
        self.store.status.set(status)
        self._poller.set_interval(self._interval())
        if not was_online:
            self.events.start()
            self._refresh_inbox()

    def _check_failed(self, error: BaseException) -> None:
        state = self.store.connection.value
        if isinstance(error, ProtocolVersionError):
            status = "incompatible"
        elif is_auth_error(error):
            status = "unauthorized"
        elif isinstance(error, NotConfigured):
            status = "unconfigured"
        else:
            status = "offline"
        if state.online:
            self.events.stop()
        self._set(state.with_(status=status, error=error, error_message=describe_error(error), checked_at=time.time()))
        if status in ("unauthorized", "incompatible"):
            self._poller.set_interval(STATUS_INTERVAL_HIDDEN_S)

    def _interval(self) -> float:
        return STATUS_INTERVAL_S if self.store.window_visible.value else STATUS_INTERVAL_HIDDEN_S

    def _visibility_changed(self, visible: bool) -> None:
        self._poller.set_interval(self._interval())
        if visible:
            self.refresh()

    def _refresh_inbox(self) -> None:
        client = self._client
        if client is None:
            return
        run_async(
            client.inbox,
            INBOX_LIMIT,
            on_success=lambda inbox: self.store.inbox.set(
                {"unreadCount": inbox.get("unreadCount", 0), "attentionCount": inbox.get("attentionCount", 0)}
            ),
            on_error=lambda error: log.debug("inbox counts failed: %s", error),
        )

    def _inbox_event(self, message: dict) -> None:
        self.store.inbox.set(
            {"unreadCount": message.get("unreadCount", 0), "attentionCount": message.get("attentionCount", 0)}
        )

    def _events_state(self, state: str) -> None:
        self.store.events.set(state)  # type: ignore[arg-type]

    def _events_error(self, error: BaseException) -> None:
        if isinstance(error, ProtocolVersionError):
            self._check_failed(error)
        elif isinstance(error, ControllerError):
            log.debug("events: %s", error)
