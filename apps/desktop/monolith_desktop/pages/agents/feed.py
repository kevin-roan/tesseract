import logging
from collections.abc import Callable
from typing import TYPE_CHECKING, Any, Literal

from ...api.errors import describe_error
from ...api.paths import ws
from ...api.socket import SocketSession
from ...api.tasks import Task
from ...api.types import AgentRun, AgentRunDetail
from ...poller import Poller
from .model import FINAL_STATES, strip_events
from .timeline import EventLog

if TYPE_CHECKING:
    from ...context import AppContext

log = logging.getLogger(__name__)

LinkState = Literal["idle", "loading", "live", "reconnecting", "polling"]
POLL_INTERVAL_S = 2.5


def is_final_message(message: dict[str, Any]) -> bool:
    run = message.get("run")
    return message.get("type") == "run" and isinstance(run, dict) and run.get("state") in FINAL_STATES


class RunFeed:
    """Follows one agent run: REST snapshot, then the replaying WebSocket stream while it runs (polling without Soup)."""

    def __init__(
        self,
        ctx: "AppContext",
        on_run: Callable[[AgentRun], None],
        on_events: Callable[[], None],
        on_link: Callable[[LinkState], None],
        on_error: Callable[[str], None],
    ) -> None:
        self._ctx = ctx
        self._on_run = on_run
        self._on_events = on_events
        self._on_link = on_link
        self._on_error = on_error
        self.log = EventLog()
        self.run_id: str | None = None
        self.run: AgentRun | None = None
        self._generation = 0
        self._socket: SocketSession | None = None
        self._poller: Poller[AgentRunDetail] | None = None
        self._task: Task | None = None
        self._was_open = False

    @property
    def active(self) -> bool:
        return self._socket is not None or self._poller is not None or self._task is not None

    def select(self, run_id: str, run: AgentRun | None = None) -> None:
        self.stop()
        self.run_id = run_id
        self.run = run
        self.log = EventLog()

    def resume(self) -> None:
        if self.run_id is None or self.active:
            return
        if self.run is not None and self.run["state"] == "running":
            self._open_stream()
        else:
            self._fetch()

    def reload(self) -> None:
        self.stop()
        self._fetch()

    def stop(self) -> None:
        self._generation += 1
        if self._socket is not None:
            self._socket.close()
            self._socket = None
        if self._poller is not None:
            self._poller.stop()
            self._poller = None
        if self._task is not None:
            self._task.cancel()
            self._task = None
        self._was_open = False
        self._on_link("idle")

    def _guard(self, fn: Callable[..., None]) -> Callable[..., None]:
        generation = self._generation

        def wrapped(*args: Any) -> None:
            if generation == self._generation:
                fn(*args)

        return wrapped

    def _fetch(self) -> None:
        run_id = self.run_id
        if run_id is None:
            return
        self._on_link("loading")
        self._task = self._ctx.call(
            lambda client: client.get_agent_run(run_id),
            on_success=self._guard(self._fetched),
            on_error=self._guard(self._fetch_failed),
        )

    def _fetched(self, detail: AgentRunDetail) -> None:
        self._task = None
        self._apply_detail(detail)
        if self.run is not None and self.run["state"] == "running":
            self._open_stream()
        else:
            self._on_link("idle")

    def _fetch_failed(self, error: BaseException) -> None:
        self._task = None
        self._on_link("idle")
        self._on_error(describe_error(error))

    def _apply_detail(self, detail: AgentRunDetail) -> None:
        changed = self.log.extend(detail.get("events") or [])
        self._set_run(strip_events(detail))
        if changed:
            self._on_events()

    def _set_run(self, run: AgentRun) -> None:
        self.run = run
        self._on_run(run)

    def _open_stream(self) -> None:
        run_id = self.run_id
        if run_id is None:
            return
        self._on_link("loading")
        self._socket = self._ctx.stream(
            ws.agent_run_stream(run_id),
            self._guard(self._message),
            on_state=self._guard(self._socket_state),
            on_close=self._guard(self._socket_closed),
            on_error=lambda error: log.debug("agent stream %s: %s", run_id, describe_error(error)),
            is_final=is_final_message,
        )
        if self._socket is None:
            self._start_polling()

    def _message(self, message: dict[str, Any]) -> None:
        kind = message.get("type")
        if kind == "event" and isinstance(message.get("event"), dict):
            if self.log.add(message["event"]):
                self._on_events()
        elif kind == "run" and isinstance(message.get("run"), dict):
            self._set_run(strip_events(message["run"]))

    def _socket_state(self, state: str) -> None:
        if state == "open":
            self._was_open = True
            self._on_link("live")
        elif state == "connecting":
            self._on_link("reconnecting" if self._was_open else "loading")

    def _socket_closed(self, _code: int, will_reconnect: bool) -> None:
        if will_reconnect:
            self._on_link("reconnecting")
            return
        self._socket = None
        self._fetch()

    def _start_polling(self) -> None:
        run_id = self.run_id
        if run_id is None:
            return
        self._on_link("polling")
        self._poller = self._ctx.poll(
            lambda client: client.get_agent_run(run_id),
            POLL_INTERVAL_S,
            self._guard(self._polled),
            self._guard(lambda error: log.debug("agent poll %s: %s", run_id, describe_error(error))),
        ).start()

    def _polled(self, detail: AgentRunDetail) -> None:
        self._apply_detail(detail)
        if self.run is not None and self.run["state"] in FINAL_STATES and self._poller is not None:
            self._poller.stop()
            self._poller = None
            self._on_link("idle")
