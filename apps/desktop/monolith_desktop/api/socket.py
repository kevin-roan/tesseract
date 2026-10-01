import json
import logging
import random
from collections.abc import Callable
from typing import Any, Literal

from gi.repository import GLib

from .client import ControllerClient
from .errors import NetworkError, NotConfigured, ProtocolError, is_auth_error
from .tasks import Task, run_async

try:
    import gi

    gi.require_version("Soup", "3.0")
    from gi.repository import Gio, Soup

    SOUP_AVAILABLE = True
except (ImportError, ValueError):
    SOUP_AVAILABLE = False

log = logging.getLogger(__name__)

SocketState = Literal["connecting", "open", "closed"]
MIN_RECONNECT_S = 1.0
MAX_RECONNECT_S = 30.0
NORMAL_CLOSE = 1000


def backoff_delay(attempt: int, minimum: float = MIN_RECONNECT_S, maximum: float = MAX_RECONNECT_S) -> float:
    base = min(maximum, minimum * 2 ** max(0, attempt))
    jittered = base / 2 + random.random() * base / 2
    return min(maximum, max(minimum, jittered))


class SocketSession:
    def __init__(
        self,
        client_provider: Callable[[], ControllerClient | None],
        path: str,
        on_message: Callable[[dict[str, Any]], None],
        on_state: Callable[[SocketState], None] | None = None,
        on_error: Callable[[BaseException], None] | None = None,
        on_close: Callable[[int, bool], None] | None = None,
        reconnect: bool = True,
        idle_timeout_s: float | None = None,
        is_final: Callable[[dict[str, Any]], bool] | None = None,
        validate: Callable[[dict[str, Any]], BaseException | None] | None = None,
        reconnect_on_normal_close: bool = False,
    ) -> None:
        if not SOUP_AVAILABLE:
            raise RuntimeError("libsoup 3 GObject bindings are not available")
        self._client_provider = client_provider
        self._path = path
        self._on_message = on_message
        self._on_state = on_state
        self._on_error = on_error
        self._on_close = on_close
        self._reconnect = reconnect
        self._idle_timeout_s = idle_timeout_s
        self._is_final = is_final
        self._validate = validate
        self._reconnect_on_normal_close = reconnect_on_normal_close
        self._session = Soup.Session()
        self._connection: Any = None
        self._cancellable: Any = None
        self._ticket_task: Task | None = None
        self._retry_source: int | None = None
        self._idle_source: int | None = None
        self._attempt = 0
        self._stopped = True
        self._finished = False
        self.state: SocketState = "closed"

    def open(self) -> "SocketSession":
        self._stopped = False
        self._finished = False
        self._connect()
        return self

    def close(self) -> None:
        self._stopped = True
        self._teardown()
        self._set_state("closed")

    def reconnect_now(self) -> None:
        if self._stopped:
            return
        self._teardown()
        self._attempt = 0
        self._connect()

    def send(self, message: dict[str, Any]) -> bool:
        if self._connection is None or self._connection.get_state() != Soup.WebsocketState.OPEN:
            return False
        self._connection.send_text(json.dumps(message))
        return True

    def _set_state(self, state: SocketState) -> None:
        if state == self.state:
            return
        self.state = state
        if self._on_state:
            self._on_state(state)

    def _report(self, error: BaseException) -> None:
        if self._on_error:
            self._on_error(error)
        else:
            log.debug("socket %s: %s", self._path, error)

    def _connect(self) -> None:
        client = self._client_provider()
        if client is None:
            self._report(NotConfigured())
            self._set_state("closed")
            return
        self._set_state("connecting")
        self._ticket_task = run_async(
            client.create_ticket,
            on_success=lambda ticket: self._open_socket(client, ticket["ticket"]),
            on_error=self._ticket_failed,
        )

    def _ticket_failed(self, error: BaseException) -> None:
        self._report(error)
        if is_auth_error(error):
            self._set_state("closed")
            return
        self._schedule_retry()

    def _open_socket(self, client: ControllerClient, ticket: str) -> None:
        if self._stopped:
            return
        message = Soup.Message.new("GET", client.ws_url(self._path, ticket))
        if message is None:
            self._report(ProtocolError(f"invalid websocket url for {self._path}"))
            self._set_state("closed")
            return
        self._cancellable = Gio.Cancellable()
        self._session.websocket_connect_async(
            message, None, None, GLib.PRIORITY_DEFAULT, self._cancellable, self._on_connected
        )

    def _on_connected(self, session: Any, result: Any) -> None:
        try:
            connection = session.websocket_connect_finish(result)
        except GLib.Error as error:
            if self._stopped:
                return
            self._report(NetworkError(error.message))
            self._schedule_retry()
            return
        if self._stopped:
            connection.close(NORMAL_CLOSE, None)
            return
        self._connection = connection
        connection.set_keepalive_interval(0)
        connection.connect("message", self._on_frame)
        connection.connect("closed", self._on_closed)
        connection.connect("error", lambda _c, error: self._report(NetworkError(error.message)))
        self._attempt = 0
        self._set_state("open")
        self._arm_idle()

    def _on_frame(self, _connection: Any, kind: int, data: Any) -> None:
        self._arm_idle()
        if kind != Soup.WebsocketDataType.TEXT:
            return
        raw = data.get_data()
        try:
            message = json.loads(bytes(raw).decode("utf-8"))
        except ValueError:
            self._report(ProtocolError(f"{self._path}: invalid frame"))
            return
        if not isinstance(message, dict):
            return
        if self._validate:
            fatal = self._validate(message)
            if fatal is not None:
                self._finished = True
                self.close()
                self._report(fatal)
                return
        try:
            self._on_message(message)
        except Exception:
            log.exception("socket message handler failed")
        if self._is_final and self._is_final(message):
            self._finished = True

    def _on_closed(self, connection: Any) -> None:
        code = connection.get_close_code()
        self._connection = None
        self._clear_idle()
        if self._stopped:
            return
        will_reconnect = (
            self._reconnect and not self._finished and (code != NORMAL_CLOSE or self._reconnect_on_normal_close)
        )
        if self._on_close:
            self._on_close(code, will_reconnect)
        if will_reconnect:
            self._schedule_retry()
        else:
            self._set_state("closed")

    def _schedule_retry(self) -> None:
        if self._stopped or not self._reconnect:
            self._set_state("closed")
            return
        self._set_state("connecting")
        delay = backoff_delay(self._attempt)
        self._attempt += 1
        self._clear_retry()
        self._retry_source = GLib.timeout_add(int(delay * 1000), self._retry)

    def _retry(self) -> bool:
        self._retry_source = None
        if not self._stopped:
            self._connect()
        return GLib.SOURCE_REMOVE

    def _arm_idle(self) -> None:
        if not self._idle_timeout_s:
            return
        self._clear_idle()
        self._idle_source = GLib.timeout_add(int(self._idle_timeout_s * 1000), self._idle_expired)

    def _idle_expired(self) -> bool:
        self._idle_source = None
        self._report(NetworkError(f"{self._path}: no frames for {self._idle_timeout_s:.0f}s"))
        if self._connection is not None:
            self._connection.close(Soup.WebsocketCloseCode.GOING_AWAY, None)
        return GLib.SOURCE_REMOVE

    def _clear_idle(self) -> None:
        if self._idle_source is not None:
            GLib.source_remove(self._idle_source)
            self._idle_source = None

    def _clear_retry(self) -> None:
        if self._retry_source is not None:
            GLib.source_remove(self._retry_source)
            self._retry_source = None

    def _teardown(self) -> None:
        self._clear_retry()
        self._clear_idle()
        if self._ticket_task:
            self._ticket_task.cancel()
            self._ticket_task = None
        if self._cancellable:
            self._cancellable.cancel()
            self._cancellable = None
        if self._connection is not None:
            connection, self._connection = self._connection, None
            if connection.get_state() == Soup.WebsocketState.OPEN:
                connection.close(NORMAL_CLOSE, None)

