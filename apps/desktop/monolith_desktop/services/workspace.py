import logging
from collections.abc import Callable, Iterable
from typing import Any, TypeVar

from ..api.client import ControllerClient
from ..api.errors import describe_error
from ..api.tasks import run_async
from ..api.types import AgentRun, Project, TerminalInfo
from ..poller import Poller
from ..store import AppStore, ConnectionState, Observable

log = logging.getLogger(__name__)

T = TypeVar("T", bound=dict)

INTERVAL_S = 10.0
INTERVAL_HIDDEN_S = 60.0


def upsert(items: list[T] | None, item: T, key: str = "id") -> list[T]:
    """Replace the entry with the same id, or put the new one first (lists are newest-first)."""
    current = list(items or [])
    for index, existing in enumerate(current):
        if existing.get(key) == item.get(key):
            current[index] = item
            return current
    return [item, *current]


def remove_ids(items: list[T] | None, ids: Iterable[str], key: str = "id") -> list[T]:
    drop = set(ids)
    return [item for item in items or [] if item.get(key) not in drop]


def apply_run(runs: list[AgentRun] | None, run: AgentRun, archived: bool = False) -> list[AgentRun]:
    """Upsert the run if it belongs to the archived / non-archived list, otherwise drop it from that list."""
    if bool(run.get("archivedAt")) != archived:
        return remove_ids(runs, [run["id"]])
    return upsert(runs, run)


class WorkspaceService:
    """Keeps store.projects / store.agent_runs / store.terminals fresh.

    Polls while the controller is online (slower when the window is hidden) and
    applies project.updated / agent.updated / agent.deleted / terminal.updated events in between.
    store.agent_runs only holds non-archived runs.
    """

    def __init__(self, store: AppStore, client: Callable[[], ControllerClient], events: Any) -> None:
        self.store = store
        self._client = client
        self._poller: Poller[tuple[list[Project], list[AgentRun], list[TerminalInfo]]] = Poller(
            self._fetch, INTERVAL_S, self._loaded, self._failed
        )
        events.subscribe("project.updated", lambda m: self._apply(store.projects, m.get("project")))
        events.subscribe("agent.updated", self._run_updated)
        events.subscribe("agent.deleted", self._runs_deleted)
        events.subscribe("project.deleted", self._project_deleted)
        events.subscribe("terminal.updated", lambda m: self._apply(store.terminals, m.get("terminal")))
        store.connection.subscribe(self._connection_changed)
        store.window_visible.subscribe(self._visibility_changed, immediate=False)

    def refresh(self) -> None:
        if self.store.connection.value.online:
            self._poller.refresh()

    def stop(self) -> None:
        self._poller.stop()

    def project(self, project_id: str | None) -> Project | None:
        if not project_id:
            return None
        return next((p for p in self.store.projects.value or [] if p["id"] == project_id), None)

    def refresh_projects(self, on_done: Callable[[BaseException | None], None] | None = None) -> None:
        def ok(projects: list[Project]) -> None:
            self.store.projects.set(projects)
            if on_done:
                on_done(None)

        def fail(error: BaseException) -> None:
            log.debug("projects refresh failed: %s", describe_error(error))
            if on_done:
                on_done(error)

        run_async(lambda: self._client().list_projects(), on_success=ok, on_error=fail)

    def _fetch(self) -> tuple[list[Project], list[AgentRun], list[TerminalInfo]]:
        client = self._client()
        return client.list_projects(), client.list_agent_runs(), client.list_terminals()

    def _loaded(self, result: tuple[list[Project], list[AgentRun], list[TerminalInfo]]) -> None:
        projects, runs, terminals = result
        self.store.projects.set(projects)
        self.store.agent_runs.set(runs)
        self.store.terminals.set(terminals)

    def _failed(self, error: BaseException) -> None:
        log.debug("workspace refresh failed: %s", describe_error(error))

    def _apply(self, observable: Observable, item: dict | None) -> None:
        if isinstance(item, dict) and item.get("id") and observable.value is not None:
            observable.set(upsert(observable.value, item))

    def _run_updated(self, message: dict) -> None:
        run = message.get("run")
        if isinstance(run, dict) and run.get("id") and self.store.agent_runs.value is not None:
            self.store.agent_runs.set(apply_run(self.store.agent_runs.value, run))

    def _project_deleted(self, message: dict) -> None:
        project_id = message.get("id")
        if isinstance(project_id, str) and self.store.projects.value is not None:
            self.store.projects.set(remove_ids(self.store.projects.value, [project_id]))

    def _runs_deleted(self, message: dict) -> None:
        ids = message.get("ids")
        if isinstance(ids, list) and self.store.agent_runs.value is not None:
            self.store.agent_runs.set(remove_ids(self.store.agent_runs.value, ids))

    def _connection_changed(self, state: ConnectionState) -> None:
        if state.online:
            if not self._poller.running:
                self._poller.start()
        else:
            self._poller.stop()
            if state.status in ("unconfigured", "discovering", "connecting"):
                self.store.projects.set(None)
                self.store.agent_runs.set(None)
                self.store.terminals.set(None)

    def _visibility_changed(self, visible: bool) -> None:
        self._poller.set_interval(INTERVAL_S if visible else INTERVAL_HIDDEN_S)
        if visible:
            self.refresh()
