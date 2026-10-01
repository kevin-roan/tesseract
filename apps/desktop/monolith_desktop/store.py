import logging
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from typing import Any, Generic, Literal, TypeVar

from .api.types import AgentRun, Health, InboxCounts, Project, SandboxStatus, TerminalInfo
from .config.model import ConnectionConfig

T = TypeVar("T")
log = logging.getLogger(__name__)

Unsubscribe = Callable[[], None]


class Observable(Generic[T]):
    def __init__(self, value: T) -> None:
        self._value = value
        self._listeners: list[Callable[[T], None]] = []

    @property
    def value(self) -> T:
        return self._value

    def get(self) -> T:
        return self._value

    def set(self, value: T) -> None:
        if value == self._value:
            return
        self._value = value
        for listener in list(self._listeners):
            try:
                listener(value)
            except Exception:
                log.exception("observable listener failed")

    def update(self, fn: Callable[[T], T]) -> None:
        self.set(fn(self._value))

    def subscribe(self, listener: Callable[[T], None], immediate: bool = True) -> Unsubscribe:
        self._listeners.append(listener)
        if immediate:
            listener(self._value)

        def unsubscribe() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)

        return unsubscribe

    def bind(self, widget: Any, listener: Callable[[T], None]) -> Unsubscribe:
        unsubscribe = self.subscribe(listener)
        widget.connect("destroy", lambda *_: unsubscribe())
        return unsubscribe

    def derive(self, fn: Callable[[T], Any]) -> "Observable[Any]":
        derived: Observable[Any] = Observable(fn(self._value))
        self.subscribe(lambda value: derived.set(fn(value)), immediate=False)
        return derived


ConnectionStatus = Literal[
    "unconfigured", "discovering", "connecting", "online", "offline", "unauthorized", "incompatible"
]
EventsStatus = Literal["idle", "connecting", "open", "closed", "unavailable", "incompatible"]


@dataclass(frozen=True)
class ConnectionState:
    status: ConnectionStatus = "unconfigured"
    config: ConnectionConfig | None = None
    health: Health | None = None
    error: BaseException | None = field(default=None, compare=False)
    error_message: str | None = None
    checked_at: float | None = None

    @property
    def online(self) -> bool:
        return self.status == "online"

    @property
    def sandbox_name(self) -> str | None:
        if self.health:
            return self.health.get("sandboxId")
        return self.config.name if self.config else None

    def with_(self, **changes: Any) -> "ConnectionState":
        return replace(self, **changes)


EMPTY_INBOX: InboxCounts = {"unreadCount": 0, "attentionCount": 0}


class AppStore:
    def __init__(self) -> None:
        self.connection: Observable[ConnectionState] = Observable(ConnectionState())
        self.status: Observable[SandboxStatus | None] = Observable(None)
        self.inbox: Observable[InboxCounts] = Observable(dict(EMPTY_INBOX))
        self.events: Observable[EventsStatus] = Observable("idle")
        self.window_visible: Observable[bool] = Observable(False)
        self.current_page: Observable[str | None] = Observable(None)
        # Shared workspace lists, kept fresh by services.workspace.WorkspaceService.
        # None = not loaded yet; lists are newest-first as the controller returns them.
        self.projects: Observable[list[Project] | None] = Observable(None)
        self.agent_runs: Observable[list[AgentRun] | None] = Observable(None)
        self.terminals: Observable[list[TerminalInfo] | None] = Observable(None)
