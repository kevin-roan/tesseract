from collections.abc import Callable
from typing import TYPE_CHECKING, Any, Literal

from ...api.client import ControllerClient
from ...api.errors import describe_error
from ...api.paths import ws
from ...api.socket import SocketSession
from ...api.types import FINAL_BUILD_STATES, LIVE_PROCESS_STATES
from ...poller import Poller
from ...widgets.log_panel import LogPanel
from .labels import LOGS
from .model import build_state, log_status

if TYPE_CHECKING:
    from gi.repository import Gtk

    from ...context import AppContext

LogKind = Literal["process", "build"]
SNAPSHOT_TAIL = 500
SNAPSHOT_INTERVAL_S = 2.0


def _is_final(kind: LogKind, item: dict[str, Any]) -> bool:
    if kind == "build":
        return item.get("state") in FINAL_BUILD_STATES
    return item.get("state") not in LIVE_PROCESS_STATES


class LogFollower:
    def __init__(
        self,
        ctx: "AppContext",
        panel: LogPanel,
        on_exit: Callable[[int | None], None] | None = None,
        on_update: Callable[[dict[str, Any]], None] | None = None,
    ) -> None:
        self._ctx = ctx
        self._panel = panel
        self._on_exit = on_exit
        self._on_update = on_update
        self._session: SocketSession | None = None
        self._poller: Poller | None = None
        self._target: tuple[LogKind, str] | None = None
        self._ended = False
        self._exit_code: int | None = None
        self._suspended = False
        self._last: dict[str, Any] | None = None

    @property
    def target(self) -> tuple[LogKind, str] | None:
        return self._target

    @property
    def ended(self) -> bool:
        return self._ended

    def bind(self, widget: "Gtk.Widget") -> "LogFollower":
        widget.connect("map", lambda *_: self._resume())
        widget.connect("unmap", lambda *_: self._suspend())
        widget.connect("destroy", lambda *_: self.stop())
        return self

    def follow(self, kind: LogKind, target_id: str) -> None:
        self.stop()
        self._target = (kind, target_id)
        self._ended = False
        self._exit_code = None
        self._last = None
        self._panel.view.clear()
        self._panel.set_notice(None)
        if self._panel.get_mapped():
            self._open()
        else:
            self._suspended = True

    def stop(self) -> None:
        self._close()
        self._target = None
        self._suspended = False

    def _suspend(self) -> None:
        if self._target and not self._ended:
            self._suspended = True
        self._close()

    def _resume(self) -> None:
        if self._suspended and self._target and not self._ended:
            self._suspended = False
            self._open()

    def _close(self) -> None:
        if self._session is not None:
            self._session.close()
            self._session = None
        if self._poller is not None:
            self._poller.stop()
            self._poller = None

    def _open(self) -> None:
        if self._target is None:
            return
        kind, target_id = self._target
        path = ws.build_log_stream(target_id) if kind == "build" else ws.process_log_stream(target_id)
        self._session = self._ctx.stream(
            path,
            self._on_message,
            on_state=self._on_state,
            on_close=self._on_close,
            is_final=lambda message: message.get("type") == "exit",
        )
        if self._session is None:
            self._panel.set_notice(LOGS["unavailable"])
            self._poller = self._ctx.poll(self._snapshot_fetch(kind, target_id), SNAPSHOT_INTERVAL_S, self._on_snapshot)
            self._poller.start()

    def _snapshot_fetch(self, kind: LogKind, target_id: str) -> Callable[[ControllerClient], tuple[list, dict]]:
        if kind == "build":
            return lambda client: (client.build_logs(target_id, SNAPSHOT_TAIL), client.get_build(target_id))
        return lambda client: (client.process_logs(target_id, SNAPSHOT_TAIL), client.get_process(target_id))

    def _updated(self, item: dict[str, Any]) -> None:
        self._last = item
        if self._on_update:
            self._on_update(item)

    def _on_snapshot(self, result: tuple[list, dict]) -> None:
        lines, item = result
        self._panel.view.append_lines(lines)
        self._updated(item)
        if self._target and _is_final(self._target[0], item):
            self._finish(item.get("exitCode") if self._target[0] == "process" else (0 if item.get("state") == "succeeded" else 1))
            self._close()

    def _on_message(self, message: dict[str, Any]) -> None:
        kind = message.get("type")
        if kind == "log" and isinstance(message.get("line"), dict):
            self._panel.view.append_line(message["line"])
        elif kind == "build" and isinstance(message.get("build"), dict):
            self._updated(message["build"])
        elif kind == "exit":
            self._finish(message.get("code"))

    def _finish(self, code: int | None) -> None:
        if self._ended:
            return
        self._ended = True
        self._exit_code = code
        if self._target and self._target[0] == "build" and self._last and _is_final("build", self._last):
            self._panel.set_status(*build_state(self._last))
        else:
            self._panel.set_status(*log_status("closed", code, ended=True))
        if self._on_exit:
            self._on_exit(code)

    def _on_state(self, state: str) -> None:
        if not self._ended:
            self._panel.set_status(*log_status(state))

    def _on_close(self, _code: int, will_reconnect: bool) -> None:
        if will_reconnect or self._ended or self._target is None:
            return
        kind, target_id = self._target
        fetch = (lambda c: c.get_build(target_id)) if kind == "build" else (lambda c: c.get_process(target_id))
        self._ctx.call(fetch, self._settle, lambda error: self._panel.set_notice(describe_error(error)))

    def _settle(self, item: dict[str, Any]) -> None:
        self._updated(item)
        if self._target and _is_final(self._target[0], item):
            code = item.get("exitCode") if self._target[0] == "process" else (0 if item.get("state") == "succeeded" else 1)
            self._finish(code)
