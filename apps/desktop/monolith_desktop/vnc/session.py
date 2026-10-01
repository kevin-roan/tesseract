import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, replace
from typing import Any, Literal

from gi.repository import GLib

from ..api.client import ControllerClient
from ..api.errors import NotConfigured, describe_error, is_auth_error
from ..api.paths import ws
from ..api.socket import SOUP_AVAILABLE, backoff_delay
from ..api.tasks import Task, run_async
from ..api.types import DisplayStatus
from ..store import Observable
from .client import AuthenticationFailed, CursorImage, RfbClient, RfbError, RfbEvents
from .framebuffer import Framebuffer, Rect
from .protocol import Security
from .jpeg import decode_jpeg

if SOUP_AVAILABLE:
    from gi.repository import Gio, Soup

log = logging.getLogger(__name__)

SUBPROTOCOLS = ["binary"]
NORMAL_CLOSE = 1000
KEEPALIVE_S = 15
PONG_TIMEOUT_S = 20
UNLIMITED_PAYLOAD = 0

Phase = Literal["idle", "connecting", "authenticating", "connected", "retrying", "auth_failed", "unavailable", "failed"]


@dataclass(frozen=True)
class SessionState:
    phase: Phase = "idle"
    error: str | None = None
    attempt: int = 0
    retry_at: float | None = None
    width: int = 0
    height: int = 0
    name: str = ""
    status: DisplayStatus | None = None

    @property
    def connected(self) -> bool:
        return self.phase == "connected"


def display_ready(status: DisplayStatus | None) -> bool:
    return bool(status and status.get("available") and status.get("vnc", {}).get("available"))


def _prepare(client: ControllerClient) -> tuple[DisplayStatus, str | None]:
    status = client.display_status()
    if not display_ready(status):
        return status, None
    return status, client.create_ticket()["ticket"]


class VncSession(RfbEvents):
    def __init__(
        self,
        client_provider: Callable[[], ControllerClient | None],
        events: RfbEvents | None = None,
        jpeg_quality: int | None = None,
    ) -> None:
        if not SOUP_AVAILABLE:
            raise RuntimeError("libsoup 3 GObject bindings are not available")
        self._client_provider = client_provider
        self._events = events or RfbEvents()
        self._jpeg_quality = jpeg_quality
        self._soup = Soup.Session()
        self._connection: Any = None
        self._cancellable: Any = None
        self._task: Task | None = None
        self._retry_source: int | None = None
        self._rfb: RfbClient | None = None
        self._running = False
        self.state: Observable[SessionState] = Observable(SessionState())

    @property
    def running(self) -> bool:
        return self._running

    @property
    def framebuffer(self) -> Framebuffer | None:
        return self._rfb.framebuffer if self._rfb and self._rfb.ready else None

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._connect()

    def stop(self) -> None:
        self._running = False
        self._teardown()
        self._set(phase="idle", error=None, attempt=0, retry_at=None)

    def reconnect(self) -> None:
        self._running = True
        self._teardown()
        self._set(attempt=0)
        self._connect()

    def key(self, keysym: int, down: bool) -> None:
        if self._rfb:
            self._rfb.key(keysym, down)

    def pointer(self, mask: int, x: int, y: int) -> None:
        if self._rfb:
            self._rfb.pointer(mask, x, y)

    def cut_text(self, text: str) -> None:
        if self._rfb:
            self._rfb.cut_text(text)

    def _set(self, **changes: Any) -> None:
        self.state.set(replace(self.state.value, **changes))

    def _connect(self) -> None:
        client = self._client_provider()
        if client is None:
            self._set(phase="failed", error=describe_error(NotConfigured()))
            return
        self._set(phase="connecting", retry_at=None)
        self._task = run_async(
            _prepare,
            client,
            on_success=lambda result: self._prepared(client, *result),
            on_error=self._prepare_failed,
        )

    def _prepare_failed(self, error: BaseException) -> None:
        if is_auth_error(error):
            self._set(phase="failed", error=describe_error(error))
            return
        self._retry(describe_error(error))

    def _prepared(self, client: ControllerClient, status: DisplayStatus, ticket: str | None) -> None:
        self._task = None
        if not self._running:
            return
        self._set(status=status)
        if ticket is None:
            self._set(phase="unavailable", error=None)
            return
        message = Soup.Message.new("GET", client.ws_url(ws.vnc(), ticket))
        password = status["vnc"].get("password") or None
        self._cancellable = Gio.Cancellable()
        self._soup.websocket_connect_async(
            message,
            None,
            SUBPROTOCOLS,
            GLib.PRIORITY_DEFAULT,
            self._cancellable,
            lambda session, result: self._opened(session, result, password),
        )

    def _opened(self, session: Any, result: Any, password: str | None) -> None:
        try:
            connection = session.websocket_connect_finish(result)
        except GLib.Error as error:
            if self._running and not error.matches(Gio.io_error_quark(), Gio.IOErrorEnum.CANCELLED):
                self._retry(error.message)
            return
        self._cancellable = None
        if not self._running:
            connection.close(NORMAL_CLOSE, None)
            return
        self._connection = connection
        connection.set_max_incoming_payload_size(UNLIMITED_PAYLOAD)
        connection.set_keepalive_interval(KEEPALIVE_S)
        connection.set_keepalive_pong_timeout(PONG_TIMEOUT_S)
        connection.connect("message", self._on_message)
        connection.connect("closed", self._on_closed)
        connection.connect("error", lambda _c, error: log.debug("vnc socket: %s", error.message))
        self._rfb = RfbClient(
            self._send, self, password=password, jpeg=decode_jpeg, jpeg_quality=self._jpeg_quality
        )

    def _send(self, data: bytes) -> None:
        connection = self._connection
        if connection is not None and connection.get_state() == Soup.WebsocketState.OPEN:
            connection.send_message(Soup.WebsocketDataType.BINARY, GLib.Bytes.new(data))

    def _on_message(self, connection: Any, kind: int, data: Any) -> None:
        if connection is not self._connection or self._rfb is None:
            return
        try:
            self._rfb.feed(data.get_data())
        except AuthenticationFailed as error:
            self._fail("auth_failed", str(error))
        except RfbError as error:
            log.warning("vnc protocol error: %s", error)
            self._close_connection()
            self._retry(str(error))
        except Exception as error:
            log.exception("vnc decoder failed")
            self._close_connection()
            self._retry(str(error))

    def _on_closed(self, connection: Any) -> None:
        if connection is not self._connection:
            return
        self._connection = None
        rfb, self._rfb = self._rfb, None
        if not self._running or self.state.value.phase in ("auth_failed", "failed"):
            return
        if rfb is not None and rfb.phase == "result" and rfb.security == Security.VNC_AUTH:
            self._fail("auth_failed", None)
            return
        self._retry(connection.get_close_data() or None)

    def _fail(self, phase: Phase, error: str | None) -> None:
        self._set(phase=phase, error=error)
        self._teardown()

    def _retry(self, error: str | None) -> None:
        self._rfb = None
        if not self._running:
            return
        attempt = self.state.value.attempt
        delay = backoff_delay(attempt)
        self._clear_retry()
        self._retry_source = GLib.timeout_add(int(delay * 1000), self._retry_now)
        self._set(phase="retrying", error=error, attempt=attempt + 1, retry_at=time.monotonic() + delay)

    def _retry_now(self) -> bool:
        self._retry_source = None
        if self._running:
            self._connect()
        return GLib.SOURCE_REMOVE

    def _clear_retry(self) -> None:
        if self._retry_source is not None:
            GLib.source_remove(self._retry_source)
            self._retry_source = None

    def _close_connection(self) -> None:
        connection, self._connection = self._connection, None
        self._rfb = None
        if connection is not None and connection.get_state() == Soup.WebsocketState.OPEN:
            connection.close(NORMAL_CLOSE, None)

    def _teardown(self) -> None:
        self._clear_retry()
        if self._task:
            self._task.cancel()
            self._task = None
        if self._cancellable:
            self._cancellable.cancel()
            self._cancellable = None
        self._close_connection()

    def on_authenticating(self) -> None:
        self._set(phase="authenticating")

    def on_connected(self, name: str, width: int, height: int) -> None:
        self._set(phase="connected", error=None, attempt=0, retry_at=None, name=name, width=width, height=height)
        self._events.on_connected(name, width, height)

    def on_resize(self, width: int, height: int) -> None:
        self._set(width=width, height=height)
        self._events.on_resize(width, height)

    def on_update(self, damage: list[Rect]) -> None:
        self._events.on_update(damage)

    def on_bell(self) -> None:
        self._events.on_bell()

    def on_cut_text(self, text: str) -> None:
        self._events.on_cut_text(text)

    def on_cursor(self, cursor: CursorImage) -> None:
        self._events.on_cursor(cursor)
