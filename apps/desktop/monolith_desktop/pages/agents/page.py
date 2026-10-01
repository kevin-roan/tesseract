import logging
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from gi.repository import Adw, GLib, GObject, Gtk

from ...api.errors import describe_error
from ...api.types import AgentRun, CountResult, Inbox, InboxItem
from ...services.workspace import apply_run, remove_ids
from ...store import Observable
from ...widgets.buttons import IconButton
from ...widgets.confirm_dialog import confirm
from ...widgets.icon import Icon
from ..base import Page
from . import model
from .conversation import ConversationPane
from .labels import ATTENTION, FILTERS, LIST, MANAGE, NEW, TITLE
from .new_view import NewConversationView
from .sidebar import ConversationList

if TYPE_CHECKING:
    from ...api.client import ControllerClient
    from ...context import AppContext

log = logging.getLogger(__name__)

COLLAPSE_CONDITION = "max-width: 640px"
SIDEBAR_WIDTH = (280, 360)
DETAILS_INTERVAL_S = 30.0
TIME_REFRESH_S = 30
INBOX_LIMIT = 100
SESSIONS_LIMIT = 50


class AgentsPage(Page):
    id = "agents"
    title = TITLE
    icon = "agents"
    section = "sandbox"
    order = 10

    @classmethod
    def badge(cls, ctx: "AppContext") -> Observable[int | None]:
        count: Observable[int | None] = Observable(None)

        def update(*_args: Any) -> None:
            count.set(model.badge_count(ctx.store.agent_runs.value, ctx.store.inbox.value))

        ctx.store.agent_runs.subscribe(update, immediate=False)
        ctx.store.inbox.subscribe(update, immediate=False)
        update()
        return count

    def __init__(self, ctx: "AppContext") -> None:
        super().__init__(ctx)
        self._selected: str | None = None
        self._inbox: list[InboxItem] = []
        self._sessions: list[Mapping] = []
        self._names: dict[str, str] = {}
        self._archived: list[AgentRun] | None = None
        self._starting = False
        self._time_source: int | None = None

    def build(self) -> Gtk.Widget:
        store = self.ctx.store
        self._list = ConversationList(
            self._select_from_list,
            self.new_conversation,
            self._open_attention,
            self._mark_read,
            self._open_terminal,
            self._filter_changed,
            self._manage,
        )
        self._new = NewConversationView(self._start_new)
        self._conversation = ConversationPane(
            self.ctx, self._follow_up, self.select_run, self._mark_read, self._open_attention, self._run_changed, self._manage
        )
        self._content = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE, hexpand=True, vexpand=True)
        self._content.add_named(self._new, "new")
        self._content.add_named(self._conversation, "conversation")

        self._split = Adw.OverlaySplitView(
            sidebar=self._list,
            content=self._content,
            min_sidebar_width=SIDEBAR_WIDTH[0],
            max_sidebar_width=SIDEBAR_WIDTH[1],
            sidebar_width_fraction=0.3,
        )
        root = Adw.BreakpointBin(child=self._split, width_request=320, height_request=320)
        breakpoint = Adw.Breakpoint.new(Adw.BreakpointCondition.parse(COLLAPSE_CONDITION))
        breakpoint.add_setter(self._split, "collapsed", True)
        breakpoint.add_setter(self._split, "show-sidebar", False)
        root.add_breakpoint(breakpoint)

        self._poller = self.ctx.poll(self._fetch_details, DETAILS_INTERVAL_S, self._details_loaded, self._details_failed)
        self._poller.bind(root)
        self.ctx.subscribe("inbox.updated", lambda _m: self._refresh_details())
        self.ctx.subscribe("hello", lambda _m: self._reconnected())
        self.ctx.subscribe("agent.updated", lambda m: self._update_archived(m.get("run")))
        self.ctx.subscribe("agent.deleted", lambda m: self._forget(m.get("ids") or []))
        root.connect("map", lambda *_: self._start_clock())
        root.connect("unmap", lambda *_: self._stop_clock())

        store.projects.bind(root, lambda _p: self._projects_changed())
        store.agent_runs.bind(root, lambda _r: self._runs_changed())
        self._show_new()
        return root

    def header_widgets(self) -> list[Gtk.Widget]:
        toggle = Gtk.ToggleButton(child=Icon("sidebar", "sm"), tooltip_text=LIST["toggle"], css_classes=["flat"])
        toggle.update_property([Gtk.AccessibleProperty.LABEL], [LIST["toggle"]])
        self._split.bind_property("show-sidebar", toggle, "active", GObject.BindingFlags.BIDIRECTIONAL | GObject.BindingFlags.SYNC_CREATE)
        new = IconButton("compose", LIST["new"], self.new_conversation)
        return [toggle, new]

    def on_shown(self) -> None:
        self.ctx.workspace.refresh()

    def open(self, params: dict[str, Any]) -> None:
        project_id = params.get("projectId")
        if params.get("runId"):
            self.select_run(str(params["runId"]))
            return
        prompt = params.get("prompt")
        if prompt and params.get("send"):
            self._show_new(project_id)
            self._start(str(prompt), project_id)
            return
        if params.get("new") or prompt or project_id:
            self.new_conversation(project_id, prompt)
        if params.get("filter") in FILTERS:
            self._list.show_filter(params["filter"])
            self._split.set_show_sidebar(True)

    def new_conversation(self, project_id: str | None = None, prompt: str | None = None) -> None:
        self._show_new(project_id)
        if prompt:
            self._new.set_prompt(prompt)
        self._new.focus()

    def select_run(self, run_id: str) -> None:
        self._selected = run_id
        self._list.set_selected(run_id)
        known = [*(self.ctx.store.agent_runs.value or []), *(self._archived or [])]
        run = next((r for r in known if r["id"] == run_id), None)
        self._conversation.show(run_id, run)
        self._push_context()
        self._content.set_visible_child_name("conversation")
        if self._split.get_collapsed():
            self._split.set_show_sidebar(False)

    def _select_from_list(self, run_id: str) -> None:
        self.select_run(run_id)

    def _show_new(self, project_id: str | None = None) -> None:
        self._selected = None
        self._list.set_selected(None)
        self._conversation.pause()
        self._new.set_projects(model.project_options(self.ctx.store.projects.value))
        if project_id is not None:
            self._new.select_project(project_id)
        self._content.set_visible_child_name("new")
        if self._split.get_collapsed():
            self._split.set_show_sidebar(False)

    def _projects_changed(self) -> None:
        self._names = model.project_names(self.ctx.store.projects.value)
        self._new.set_projects(model.project_options(self.ctx.store.projects.value))
        self._render_list()

    def _runs_changed(self) -> None:
        runs = self.ctx.store.agent_runs.value or []
        if self._selected:
            run = next((r for r in runs if r["id"] == self._selected), None)
            if run is not None:
                self._conversation.update_run(run)
        self._render_list()

    def _render_list(self) -> None:
        attention = model.notice_items(self._inbox)
        self._list.set_data(self.ctx.store.agent_runs.value, self._names, attention, self._sessions)
        self._list.set_archived(self._archived)
        self._push_context()

    def _push_context(self) -> None:
        self._conversation.set_context(
            self._names, self.ctx.store.agent_runs.value or [], model.notice_items(self._inbox), self._sessions
        )

    def _start_new(self, prompt: str, project_id: str | None) -> None:
        self._start(prompt, project_id)

    def _start(self, prompt: str, project_id: str | None, resume_session_id: str | None = None) -> None:
        if self._starting:
            return
        self._starting = True
        follow_up = resume_session_id is not None
        if not follow_up:
            self._new.set_busy(True)
            self._new.set_error(None)

        def ok(run: AgentRun) -> None:
            self.ctx.store.agent_runs.set(model.upsert_run(self.ctx.store.agent_runs.value, run))
            if follow_up:
                self._conversation.follow_up_finished(None)
            else:
                self._new.sent()
            self.select_run(run["id"])
            self._refresh_details()

        def failed(error: BaseException) -> None:
            message = NEW["failed"].format(error=describe_error(error))
            if follow_up:
                self._conversation.follow_up_finished(message)
            else:
                self._new.set_error(message)
            self.ctx.toast(message)

        def done() -> None:
            self._starting = False
            self._new.set_busy(False)

        self.ctx.call(
            lambda client: client.start_agent_run(prompt, project_id or None, resume_session_id), ok, failed, done
        )

    def _follow_up(self, prompt: str, run: AgentRun) -> None:
        self._start(prompt, run.get("projectId"), run.get("sessionId"))

    def _run_changed(self, run: AgentRun) -> None:
        if model.is_archived(run):
            self._update_archived(run)
            return
        runs = self.ctx.store.agent_runs.value
        if runs is None:
            return
        current = next((r for r in runs if r["id"] == run["id"]), None)
        if current is None or any(current.get(key) != value for key, value in run.items()):
            self.ctx.store.agent_runs.set(model.upsert_run(runs, run))

    def _filter_changed(self, filter_id: str) -> None:
        if filter_id == model.ARCHIVED_FILTER:
            self._load_archived()

    def _reconnected(self) -> None:
        self._refresh_details()
        if self._list.archived_view:
            self._load_archived()

    def _load_archived(self) -> None:
        def ok(runs: list[AgentRun]) -> None:
            self._archived = list(runs or [])
            self._render_list()

        def failed(error: BaseException) -> None:
            self._archived = self._archived or []
            self._render_list()
            self.ctx.toast(MANAGE["load_failed"].format(error=describe_error(error)))

        self.ctx.call(lambda client: client.list_agent_runs(archived=True), ok, failed)

    def _update_archived(self, run: AgentRun | None) -> None:
        if isinstance(run, dict) and run.get("id") and self._archived is not None:
            self._archived = apply_run(self._archived, run, archived=True)
            self._render_list()

    def _manage(self, action: str, run_id: str | None) -> None:
        runs = self.ctx.store.agent_runs.value
        if action in ("archive", "unarchive") and run_id:
            self._archive([run_id], action == "archive")
        elif action == "archive_all":
            self._archive(model.finished_ids(runs), True, all_runs=True)
        elif action == "delete" and run_id:
            self._confirm_delete([run_id])
        elif action == "delete_all":
            self._confirm_delete(model.finished_ids(runs))
        elif action == "empty_archive":
            self._confirm_delete(model.finished_ids(self._archived), archived_only=True)

    def _archive(self, ids: list[str], archived: bool, all_runs: bool = False, undoable: bool = True) -> None:
        if not ids:
            return

        def ok(result: CountResult | None) -> None:
            count = int((result or {}).get("count", len(ids)))
            self._forget(ids, keep_selection=not archived)
            if not archived and self._selected in ids and self._conversation.run is not None:
                self._conversation.update_run({**self._conversation.run, "archivedAt": None})
            if archived and self._archived is not None:
                self._load_archived()
            if not archived:
                self.ctx.workspace.refresh()
            message = MANAGE["archived" if archived else "unarchived"].format(count=model.count_label(count))
            if undoable and count:
                self.ctx.toast(message, action_label=MANAGE["undo"], on_action=lambda: self._archive(ids, not archived, undoable=False))
            else:
                self.ctx.toast(message)

        self.ctx.call(
            lambda client: client.archive_agent_runs(None if all_runs else ids, archived, all_runs), ok, self._manage_failed
        )

    def _confirm_delete(self, ids: list[str], archived_only: bool = False) -> None:
        if not ids:
            return
        count = model.count_label(len(ids))
        confirm(
            self._split,
            MANAGE["confirm_title"].format(count=count),
            MANAGE["confirm_body"].format(count=count),
            MANAGE["confirm_yes"],
            MANAGE["confirm_no"],
            lambda: self._delete(ids, archived_only),
        )

    def _delete(self, ids: list[str], archived_only: bool) -> None:
        def ok(result: CountResult | None) -> None:
            self._forget(ids)
            count = int((result or {}).get("count", len(ids)))
            self.ctx.toast(MANAGE["deleted"].format(count=model.count_label(count)))

        def request(client: "ControllerClient") -> CountResult:
            if archived_only:
                return client.delete_agent_runs(all_runs=True, archived=True)
            return client.delete_agent_runs(ids)

        self.ctx.call(request, ok, self._manage_failed)

    def _forget(self, ids: list[str], keep_selection: bool = False) -> None:
        drop = set(ids)
        runs = self.ctx.store.agent_runs.value
        if runs is not None and any(run["id"] in drop for run in runs):
            self.ctx.store.agent_runs.set(remove_ids(runs, drop))
        if self._archived is not None and any(run["id"] in drop for run in self._archived):
            self._archived = remove_ids(self._archived, drop)
            self._render_list()
        if not keep_selection and self._selected in drop:
            self._show_new()

    def _manage_failed(self, error: BaseException) -> None:
        self.ctx.toast(MANAGE["failed"].format(error=describe_error(error)))

    def _open_attention(self, item: InboxItem) -> None:
        if model.is_file_item(item):
            self._mark_read(item, announce=False)
            self.ctx.navigate("files", {"artifactId": item["artifactId"], "projectId": item.get("projectId")})
        elif item.get("agentRunId"):
            self.select_run(item["agentRunId"])
        elif item.get("terminalId"):
            self._open_terminal(item["terminalId"])

    def _open_terminal(self, terminal_id: str) -> None:
        self.ctx.navigate("terminals", {"terminalId": terminal_id})

    def _mark_read(self, item: InboxItem, announce: bool = True) -> None:
        self._inbox = [i for i in self._inbox if i["id"] != item["id"]]
        self._render_list()

        def ok(counts: Mapping) -> None:
            self.ctx.store.inbox.set(
                {"unreadCount": counts.get("unreadCount", 0), "attentionCount": counts.get("attentionCount", 0)}
            )
            if announce:
                self.ctx.toast(ATTENTION["marked"])

        def failed(error: BaseException) -> None:
            self.ctx.toast(ATTENTION["failed"].format(error=describe_error(error)))
            self._refresh_details()

        self.ctx.call(lambda client: client.mark_inbox_read([item["id"]]), ok, failed)

    def _fetch_details(self, client: "ControllerClient") -> tuple[Inbox, list[Mapping]]:
        inbox = client.inbox(limit=INBOX_LIMIT, unread=True)
        try:
            sessions = client.sessions(limit=SESSIONS_LIMIT)
        except Exception as error:  # noqa: BLE001
            log.debug("sessions unavailable: %s", describe_error(error))
            sessions = self._sessions
        return inbox, sessions

    def _details_loaded(self, result: tuple[Inbox, list[Mapping]]) -> None:
        inbox, sessions = result
        self._inbox = list(inbox.get("items") or [])
        self._sessions = list(sessions or [])
        self._render_list()

    def _details_failed(self, error: BaseException) -> None:
        log.debug("agents details failed: %s", describe_error(error))

    def _refresh_details(self) -> None:
        if self._poller.running:
            self._poller.refresh()

    def _start_clock(self) -> None:
        if self._time_source is None:
            self._time_source = GLib.timeout_add_seconds(TIME_REFRESH_S, self._tick)

    def _stop_clock(self) -> None:
        if self._time_source is not None:
            GLib.source_remove(self._time_source)
            self._time_source = None

    def _tick(self) -> bool:
        self._list.refresh_times()
        return GLib.SOURCE_CONTINUE
