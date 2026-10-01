from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from ...api.errors import describe_error
from ...api.paths import ws
from ...api.types import TerminalInfo
from ...widgets.terminal.view import TerminalView
from .model import SessionState

if TYPE_CHECKING:
    from ...api.socket import SocketSession
    from ...context import AppContext

MAX_QUEUED_INPUT = 65536


class TerminalSession:
    def __init__(self, ctx: "AppContext", info: TerminalInfo, on_change: Callable[["TerminalSession"], None]) -> None:
        self.ctx = ctx
        self.info = info
        self.id = info["id"]
        self.state: SessionState = "connecting"
        self.exit_code: int | None = None
        self.window_title = ""
        self.error: str | None = None
        self._on_change = on_change
        self._socket: "SocketSession | None" = None
        self._queue: list[str] = []
        self._opened_once = False
        self.view = TerminalView(on_input=self._input, on_resize=self._resize, on_title=self._title)

    def attach(self) -> None:
        self._socket = self.ctx.stream(
            ws.terminal_stream(self.id),
            self._on_message,
            on_state=self._on_state,
            on_error=self._on_error,
            is_final=lambda message: message.get("type") == "exit",
        )
        if self._socket is None:
            self._set_state("unavailable")

    def reconnect(self) -> None:
        if self.state == "exited":
            return
        if self._socket is None:
            self.attach()
        elif self._socket.state == "closed":
            self._socket.open()
        else:
            self._socket.reconnect_now()

    def detach(self) -> None:
        if self._socket is not None:
            socket, self._socket = self._socket, None
            socket.close()
        self.view.release()

    def update_info(self, info: TerminalInfo) -> None:
        self.info = info
        if info.get("state") == "exited" and self.state not in ("exited", "open"):
            self._mark_exited(info.get("exitCode"))

    def _set_state(self, state: SessionState) -> None:
        if state == self.state:
            return
        self.state = state
        self.view.set_input_enabled(state in ("open", "connecting", "reconnecting"))
        self._on_change(self)

    def _on_state(self, state: str) -> None:
        if state == "open":
            self.view.reset()
        if self.state == "exited":
            return
        if state == "open":
            self._opened_once = True
            self.error = None
            self._set_state("open")
            self._resize(*self.view.grid)
            queued, self._queue = self._queue, []
            for data in queued:
                self._input(data)
        elif state == "connecting":
            self._set_state("reconnecting" if self._opened_once else "connecting")
        elif state == "closed":
            self._set_state("closed")

    def _on_message(self, message: dict[str, Any]) -> None:
        kind = message.get("type")
        if kind == "output":
            data = message.get("data")
            if isinstance(data, str):
                self.view.feed(data)
        elif kind == "exit":
            code = message.get("code")
            self._mark_exited(code if isinstance(code, int) else None)

    def _mark_exited(self, code: int | None) -> None:
        self.exit_code = code
        self.info = {**self.info, "state": "exited", "exitCode": code}
        self._set_state("exited")

    def _on_error(self, error: BaseException) -> None:
        self.error = describe_error(error)
        if self.state == "closed":
            self._on_change(self)

    def _input(self, data: str) -> None:
        if self.state == "exited":
            return
        if self._socket is not None and self._socket.send({"type": "input", "data": data}):
            return
        if sum(len(item) for item in self._queue) + len(data) <= MAX_QUEUED_INPUT:
            self._queue.append(data)

    def _resize(self, cols: int, rows: int) -> None:
        if self._socket is not None and self.state == "open":
            self._socket.send({"type": "resize", "cols": cols, "rows": rows})

    def _title(self, title: str) -> None:
        self.window_title = title
        self._on_change(self)
