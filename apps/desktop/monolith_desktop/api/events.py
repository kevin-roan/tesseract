import logging
from collections.abc import Callable
from typing import Any

from .client import ControllerClient
from .errors import PROTOCOL_VERSION, ProtocolVersionError
from .paths import ws
from .socket import SOUP_AVAILABLE, SocketSession, SocketState

log = logging.getLogger(__name__)

EVENTS_IDLE_TIMEOUT_S = 60.0
ALL = "*"

EventListener = Callable[[dict[str, Any]], None]


def validate_hello(message: dict[str, Any]) -> BaseException | None:
    if message.get("type") == "hello" and message.get("protocolVersion") != PROTOCOL_VERSION:
        return ProtocolVersionError(message.get("protocolVersion"))
    return None


class EventStream:
    def __init__(
        self,
        client_provider: Callable[[], ControllerClient | None],
        on_state: Callable[[str], None] | None = None,
        on_error: Callable[[BaseException], None] | None = None,
    ) -> None:
        self._client_provider = client_provider
        self._on_state = on_state
        self._on_error = on_error
        self._listeners: dict[str, list[EventListener]] = {}
        self._session: SocketSession | None = None
        self.available = SOUP_AVAILABLE

    @property
    def state(self) -> str:
        if not self.available:
            return "unavailable"
        return self._session.state if self._session else "idle"

    def subscribe(self, event_type: str | None, listener: EventListener) -> Callable[[], None]:
        key = event_type or ALL
        self._listeners.setdefault(key, []).append(listener)

        def unsubscribe() -> None:
            listeners = self._listeners.get(key, [])
            if listener in listeners:
                listeners.remove(listener)

        return unsubscribe

    def start(self) -> None:
        if not self.available:
            self._emit_state("unavailable")
            return
        if self._session is not None:
            self._session.reconnect_now()
            return
        self._session = SocketSession(
            self._client_provider,
            ws.events(),
            on_message=self._dispatch,
            on_state=self._session_state,
            on_error=self._error,
            reconnect=True,
            idle_timeout_s=EVENTS_IDLE_TIMEOUT_S,
            validate=validate_hello,
            reconnect_on_normal_close=True,
        ).open()

    def stop(self) -> None:
        if self._session is not None:
            self._session.close()
            self._session = None
        self._emit_state("idle")

    def restart(self) -> None:
        self.stop()
        self.start()

    def _session_state(self, state: SocketState) -> None:
        self._emit_state(state)

    def _emit_state(self, state: str) -> None:
        if self._on_state:
            self._on_state(state)

    def _error(self, error: BaseException) -> None:
        if isinstance(error, ProtocolVersionError):
            self._emit_state("incompatible")
        if self._on_error:
            self._on_error(error)

    def _dispatch(self, message: dict[str, Any]) -> None:
        event_type = message.get("type")
        if event_type == "ping" and self._session is not None:
            self._session.send({"type": "pong"})
        for key in (event_type, ALL):
            for listener in list(self._listeners.get(key or "", [])):
                try:
                    listener(message)
                except Exception:
                    log.exception("event listener failed for %s", event_type)
