from collections.abc import Callable
from typing import Any

from gi.repository import Gtk

from ...api.client import ControllerClient
from ...api.types import AgentRun, BuildJob, ProcessInfo, Project
from ...services.workspace import upsert
from ...store import ConnectionState
from ...util.format import pluralize
from ...widgets.feedback import EmptyState
from ...widgets.header import HeaderAction, ScreenHeader
from ...widgets.keyed_list import KeyedGrid
from ...widgets.lifecycle import while_mapped
from ...widgets.motion import crossfade_stack
from ...widgets.page_body import PageBody
from ...widgets.project_card import ProjectCard
from ..base import Page
from .create_dialog import CreateProjectDialog
from .detail import ProjectDetail
from .labels import CONNECTION, EMPTY, LIST, PROJECTS_ROOT, TITLE
from .model import card_model, filter_projects, sort_projects

ACTIVITY_INTERVAL_S = 15.0
STATE, CONTENT = "state", "content"
SEARCH_SHORTCUT = "<Control>f"
DETAIL_TAG = "project:{id}"


class ProjectsPage(Page):
    id = "projects"
    title = TITLE
    icon = "projects"
    section = "sandbox"
    order = 20

    def build(self) -> Gtk.Widget:
        self._query = ""
        self._processes: list[ProcessInfo] | None = None
        self._builds: list[BuildJob] | None = None
        self._stack = crossfade_stack()
        self._state = EmptyState(LIST["loading"], loading=True)
        self._stack.add_named(self._state, STATE)

        body = PageBody(spacing=24)
        self._header = ScreenHeader(
            TITLE,
            actions=[
                HeaderAction("refresh", "refresh", LIST["refresh"], self.refresh),
                HeaderAction("add", "add", LIST["new"], self.create),
            ],
        )
        body.append(self._header)

        self._search = Gtk.SearchEntry(placeholder_text=LIST["search"], hexpand=True, valign=Gtk.Align.CENTER)
        self._search.add_css_class("to-project-search")
        self._search.connect("search-changed", lambda entry: self._set_query(entry.get_text()))
        body.append(self._search)

        self._no_match = EmptyState("", icon="search")
        self._no_match.set_visible(False)
        body.append(self._no_match)
        self._grid = KeyedGrid(lambda: ProjectCard(self.open_project, self._ask, LIST["ask"]), ProjectCard.update)
        body.append(self._grid)
        self._stack.add_named(body, CONTENT)

        shortcuts = Gtk.ShortcutController(scope=Gtk.ShortcutScope.MANAGED)
        shortcuts.add_shortcut(Gtk.Shortcut(
            trigger=Gtk.ShortcutTrigger.parse_string(SEARCH_SHORTCUT),
            action=Gtk.CallbackAction.new(lambda *_: self._search.grab_focus() or True),
        ))
        body.add_controller(shortcuts)

        self._poller = self.ctx.poll(self._fetch_activity, ACTIVITY_INTERVAL_S, self._activity_loaded).bind(self._stack)
        while_mapped(self._stack, self._attach)
        self._render()
        return self._stack

    def open(self, params: dict[str, Any]) -> None:
        if params.get("create"):
            self.create()
        project_id = params.get("projectId")
        if isinstance(project_id, str) and project_id:
            self.open_project(project_id, params.get("tab"))

    def on_shown(self) -> None:
        self.ctx.workspace.refresh()

    def create(self) -> None:
        CreateProjectDialog(self.ctx, lambda project_id: self.ctx.navigate(self.id, {"projectId": project_id})).present()

    def open_project(self, project_id: str, tab: str | None = None) -> None:
        detail = ProjectDetail(self.ctx, project_id)
        project = detail.project
        title = project.get("name", project_id) if project else project_id
        detail.page = self.push(title, detail.widget, detail.header_widgets(), DETAIL_TAG.format(id=project_id))
        if tab:
            detail.show_tab(tab)

    def refresh(self) -> None:
        self.ctx.workspace.refresh()
        self._poller.refresh()

    def _ask(self, project_id: str) -> None:
        self.ctx.navigate("agents", {"new": True, "projectId": project_id})

    def _attach(self) -> Callable[[], None]:
        store = self.ctx.store
        detach = [
            store.projects.subscribe(lambda _v: self._render()),
            store.agent_runs.subscribe(lambda _v: self._render(), immediate=False),
            store.connection.subscribe(lambda _v: self._render(), immediate=False),
            self.ctx.subscribe("process.updated", lambda m: self._event("_processes", m.get("process"))),
            self.ctx.subscribe("build.updated", lambda m: self._event("_builds", m.get("build"))),
        ]
        return lambda: [unsubscribe() for unsubscribe in detach]

    def _fetch_activity(self, client: ControllerClient) -> tuple[list[ProcessInfo], list[BuildJob]]:
        return client.list_processes(), client.list_builds()

    def _activity_loaded(self, result: tuple[list[ProcessInfo], list[BuildJob]]) -> None:
        self._processes, self._builds = result
        self._render()

    def _event(self, attr: str, item: Any) -> None:
        current = getattr(self, attr)
        if isinstance(item, dict) and item.get("id") and current is not None:
            setattr(self, attr, upsert(current, item))
            self._render()

    def _set_query(self, query: str) -> None:
        self._query = query
        self._render()

    def _render(self) -> None:
        store = self.ctx.store
        projects = store.projects.value
        if projects is None:
            self._render_connection(store.connection.value)
            return
        if not projects:
            self._show_state(EMPTY["title"], EMPTY["message"], "projects", False, EMPTY["action"], self.create,
                             EMPTY["secondary"], lambda: self.ctx.navigate("agents", {"new": True}))
            return
        self._stack.set_visible_child_name(CONTENT)
        self._header.set_subtitle(LIST["subtitle"].format(count=pluralize(len(projects), "project"), root=PROJECTS_ROOT))
        runs: list[AgentRun] | None = store.agent_runs.value
        visible: list[Project] = sort_projects(filter_projects(projects, self._query), self._processes, self._builds, runs)
        self._grid.sync((p["id"], card_model(p, self._processes, self._builds, runs)) for p in visible)
        self._grid.set_visible(bool(visible))
        self._no_match.set_visible(not visible)
        if not visible:
            self._no_match.set_content(
                LIST["no_match_title"], LIST["no_match"].format(query=self._query.strip()), "search",
                action_label=LIST["clear_search"], on_action=lambda: self._search.set_text(""),
            )

    def _render_connection(self, state: ConnectionState) -> None:
        if state.online:
            self._show_state(LIST["loading"], None, None, True)
            return
        title, message, action, action_id = CONNECTION.get(state.status, CONNECTION["connecting"])
        loading = action_id is None
        callback = self.ctx.connection.refresh if action_id == "retry" else self.ctx.open_preferences
        self._show_state(title, (message or "").format(error=state.error_message or "") or None,
                         None if loading else "offline", loading, action, callback if action_id else None)

    def _show_state(
        self,
        title: str,
        message: str | None,
        icon: str | None,
        loading: bool,
        action: str | None = None,
        on_action: Callable[[], None] | None = None,
        secondary: str | None = None,
        on_secondary: Callable[[], None] | None = None,
    ) -> None:
        self._state.set_content(title, message, icon, loading, action, on_action, secondary, on_secondary)
        self._stack.set_visible_child_name(STATE)
