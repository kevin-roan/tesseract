from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from gi.repository import Adw, Gtk

from ...api.client import ControllerClient
from ...api.errors import ControllerError, describe_error
from ...api.types import AgentRun, ClaudeAccountList, GitDetails, Project
from ...services.workspace import upsert
from ...theme.icons import resolve_icon
from ...widgets.badges import StatusBadge
from ...widgets.buttons import ActionButton, IconButton
from ...widgets.choice_dropdown import ChoiceDropdown
from ...widgets.desktop import copy_text
from ...widgets.feedback import EmptyState, Notice
from ...widgets.header import HeaderAction, ScreenHeader
from ...widgets.lifecycle import while_mapped
from ...widgets.motion import crossfade_stack, view_stack
from ...widgets.page_body import PageBody
from .labels import CLAUDE_ACCOUNT, DETAIL, GIT, TABS
from .model import (
    DEFAULT_CLAUDE_ACCOUNT,
    active_build_count,
    claude_account_label,
    claude_account_options,
    confidential_badge,
    detail_subtitle,
    dirty_badge,
    effective_claude_account,
    framework_label,
    project_activity,
    project_artifacts,
    project_builds,
    project_claude_account,
    project_processes,
    running_count,
    sync_label,
)
from .tab_artifacts import ArtifactsTab
from .tab_builds import BuildsTab
from .tab_conversations import ConversationsTab
from .tab_git import GitTab
from .tab_processes import ProcessesTab
from .tab_sync import SyncTab

if TYPE_CHECKING:
    from ...context import AppContext

REFRESH_INTERVAL_S = 15.0
LOADING, ERROR, CONTENT = "loading", "error", "content"
SORTERS: dict[str, Callable[[list, str], list]] = {
    "processes": project_processes,
    "builds": project_builds,
    "artifacts": project_artifacts,
}
EVENTS = (("process.updated", "process", "processes"), ("build.updated", "build", "builds"), ("artifact.created", "artifact", "artifacts"))


class ProjectDetail:
    def __init__(self, ctx: "AppContext", project_id: str) -> None:
        self.ctx = ctx
        self.project_id = project_id
        self.project: Project | None = ctx.workspace.project(project_id)
        self.page: Adw.NavigationPage | None = None
        self._lists: dict[str, list | None] = {"processes": None, "builds": None, "artifacts": None}
        self._git: GitDetails | None = None
        self._git_error: BaseException | None = None
        self._fetch_failed = False
        self._runs: list[AgentRun] | None = None
        self._accounts: ClaudeAccountList | None = None

        self.widget = crossfade_stack()
        self._state = EmptyState(DETAIL["loading"], loading=True)
        self.widget.add_named(self._state, LOADING)
        self.widget.add_named(self._build_content(), CONTENT)
        self._poller = ctx.poll(self._fetch, REFRESH_INTERVAL_S, self._loaded, self._failed).bind(self.widget)
        while_mapped(self.widget, self._attach)
        self._render()

    def _build_content(self) -> Gtk.Widget:
        body = PageBody(spacing=24)
        self._badges = Adw.WrapBox(child_spacing=6, line_spacing=6)
        self._framework = StatusBadge("", icon="project")
        self._branch = StatusBadge("", icon="branch")
        self._sync = StatusBadge("", "info")
        self._dirty = StatusBadge("")
        self._activity = StatusBadge("")
        self._confidential = StatusBadge("", icon="confidential")
        self._claude_account = StatusBadge("", icon="agents")
        for badge in (
            self._confidential, self._activity, self._framework, self._branch, self._sync, self._dirty, self._claude_account
        ):
            self._badges.append(badge)
        self._header = ScreenHeader(
            self.project_id,
            actions=[HeaderAction("copy", "copy", DETAIL["copy_path"], self._copy_path)],
            accessory=self._badges,
        )
        self._badges.set_margin_top(8)
        body.append(self._header)

        quick = Adw.WrapBox(child_spacing=8, line_spacing=8)
        quick.append(ActionButton(DETAIL["ask"], self.ask_claude, "primary", "agents"))
        quick.append(ActionButton(DETAIL["claude_terminal"], lambda: self._terminal("claude"), "secondary", "terminal"))
        quick.append(ActionButton(DETAIL["shell"], lambda: self._terminal("shell"), "secondary", "terminal"))
        quick.append(ActionButton(DETAIL["display"], lambda: self.ctx.navigate("display"), "secondary", "display"))
        self._account_picker = ChoiceDropdown(on_change=self._set_claude_account, tooltip=CLAUDE_ACCOUNT["tooltip"])
        self._account_picker.set_visible(False)
        quick.append(self._account_picker)
        body.append(quick)

        self._notice = Notice("", tone="danger")
        self._notice.set_visible(False)
        self._notice.set_action(DETAIL["dismiss"], lambda: self._notice.set_visible(False))
        body.append(self._notice)

        self._stack = view_stack(vhomogeneous=False)
        self.git = GitTab()
        self.processes = ProcessesTab(self)
        self.builds = BuildsTab(self)
        self.artifacts = ArtifactsTab(self)
        self.conversations = ConversationsTab(self)
        self._pages: dict[str, Adw.ViewStackPage] = {}
        self.sync_back = SyncTab(self, self._sync_count)
        for name, tab, icon in (
            ("git", self.git, "branch"),
            ("sync", self.sync_back, "host"),
            ("processes", self.processes, "processes"),
            ("builds", self.builds, "builds"),
            ("artifacts", self.artifacts, "artifacts"),
            ("conversations", self.conversations, "agents"),
        ):
            self._pages[name] = self._stack.add_titled_with_icon(tab.widget, name, TABS[name], resolve_icon(icon))
        switcher = Adw.InlineViewSwitcher(stack=self._stack, can_shrink=False, halign=Gtk.Align.START)
        tabs = Gtk.ScrolledWindow(
            child=switcher,
            vscrollbar_policy=Gtk.PolicyType.NEVER,
            hscrollbar_policy=Gtk.PolicyType.EXTERNAL,
            propagate_natural_height=True,
            css_classes=["to-project-tabs"],
        )
        body.append(tabs)
        body.append(self._stack)
        return body

    def header_widgets(self) -> list[Gtk.Widget]:
        return [IconButton("refresh", DETAIL["refresh"], self.refresh)]

    def _sync_count(self, count: int) -> None:
        if "sync" in self._pages:
            self._pages["sync"].set_badge_number(count)

    def show_tab(self, name: str) -> None:
        if name in self._pages:
            self._stack.set_visible_child_name(name)

    def _attach(self) -> Callable[[], None]:
        detach = [
            self.ctx.subscribe(event, lambda message, key=key, kind=kind: self._event(kind, message.get(key)))
            for event, key, kind in EVENTS
        ]
        detach.append(self.ctx.subscribe("artifact.deleted", lambda message: self.remove("artifacts", message.get("id"))))
        detach.append(self.ctx.store.projects.subscribe(self._store_projects))
        detach.append(self.ctx.store.agent_runs.subscribe(self._store_runs))
        return lambda: [unsubscribe() for unsubscribe in detach]

    def _fetch(self, client: ControllerClient) -> dict[str, Any]:
        project = client.get_project(self.project_id)
        snapshot: dict[str, Any] = {
            "project": project,
            "processes": client.list_processes(self.project_id),
            "builds": client.list_builds(self.project_id),
            "artifacts": client.list_artifacts(self.project_id),
            "git": None,
            "git_error": None,
            "accounts": None,
        }
        try:
            snapshot["accounts"] = client.claude_accounts()
        except ControllerError:
            pass
        if project.get("git"):
            try:
                snapshot["git"] = client.get_project_git(self.project_id)
            except ControllerError as error:
                snapshot["git_error"] = error
        return snapshot

    def _loaded(self, snapshot: dict[str, Any]) -> None:
        self.project = snapshot["project"]
        for kind in self._lists:
            self._lists[kind] = SORTERS[kind](snapshot[kind], self.project_id)
        self._git = snapshot["git"]
        self._git_error = snapshot["git_error"]
        self._accounts = snapshot["accounts"]
        if self._fetch_failed:
            self._fetch_failed = False
            self._notice.set_visible(False)
        self._render()

    def _failed(self, error: BaseException) -> None:
        if self.project is None:
            self._state.set_content(
                DETAIL["error_title"], describe_error(error), "warning", False, DETAIL["retry"], self.refresh
            )
            self.widget.set_visible_child_name(LOADING)
            return
        self._fetch_failed = True
        self.report(error)

    def _store_projects(self, projects: list[Project] | None) -> None:
        fresh = next((p for p in projects or [] if p["id"] == self.project_id), None)
        if fresh is None or fresh == self.project:
            return
        git_changed = self.project is not None and fresh.get("git") != self.project.get("git")
        self.project = fresh
        self._render()
        if git_changed:
            self._poller.refresh()

    def _store_runs(self, runs: list[AgentRun] | None) -> None:
        self._runs = runs
        self.conversations.render(runs)
        self._render_header()

    def _event(self, kind: str, item: Any) -> None:
        if not isinstance(item, dict) or item.get("projectId") != self.project_id:
            return
        self.upsert(kind, item)

    def upsert(self, kind: str, item: dict[str, Any]) -> None:
        current = self._lists.get(kind)
        if item.get("projectId") != self.project_id or current is None:
            return
        self._lists[kind] = SORTERS[kind](upsert(current, item), self.project_id)
        self._render_lists()

    def remove(self, kind: str, item_id: Any) -> None:
        current = self._lists.get(kind)
        if current is None or not any(item.get("id") == item_id for item in current):
            return
        self._lists[kind] = [item for item in current if item.get("id") != item_id]
        self._render_lists()

    def report(self, error: BaseException | str) -> None:
        message = error if isinstance(error, str) else describe_error(error)
        self._notice.update(message, tone="danger")
        self._notice.set_visible(True)

    def refresh(self) -> None:
        if self.project is None:
            self._state.set_content(DETAIL["loading"], loading=True)
        self._poller.refresh()
        self.sync_back.refresh()
        self.ctx.workspace.refresh()

    def ask_claude(self) -> None:
        self.ctx.navigate("agents", {"new": True, "projectId": self.project_id})

    def _terminal(self, kind: str) -> None:
        self.ctx.navigate("terminals", {"kind": kind, "projectId": self.project_id})

    def _set_claude_account(self, option_id: str) -> None:
        if self.project is None:
            return
        account_id = option_id if option_id != DEFAULT_CLAUDE_ACCOUNT else None
        if account_id == project_claude_account(self.project):
            return
        self._account_picker.set_sensitive(False)
        self.ctx.call(
            lambda client: client.set_project_claude_account(self.project_id, account_id),
            self._claude_account_changed,
            lambda error: self.report(CLAUDE_ACCOUNT["change_failed"].format(error=describe_error(error))),
            self._claude_account_settled,
        )

    def _claude_account_changed(self, project: Project) -> None:
        self.project = project
        if self.ctx.store.projects.value is not None:
            self.ctx.store.projects.set(upsert(self.ctx.store.projects.value, project))
        account = effective_claude_account(project, self._accounts)
        if account:
            self.ctx.toast(CLAUDE_ACCOUNT["changed"].format(project=project.get("name") or project["id"], account=account))

    def _claude_account_settled(self) -> None:
        self._account_picker.set_sensitive(True)
        self._render_header()

    def _copy_path(self) -> None:
        if self.project:
            copy_text(self.widget, self.project["path"])
            self.ctx.toast(DETAIL["copied"])

    def _render(self) -> None:
        if self.project is None:
            return
        self.widget.set_visible_child_name(CONTENT)
        self._render_header()
        self.git.render(self.project, self._git, self._git_error)
        self._render_lists()

    def _render_lists(self) -> None:
        if self.project is None:
            return
        self.processes.render(self.project, self._lists["processes"])
        self.builds.render(self.project, self._lists["builds"])
        self.artifacts.render(self._lists["artifacts"])
        self._pages["processes"].set_badge_number(running_count(self._lists["processes"]))
        self._pages["builds"].set_badge_number(active_build_count(self._lists["builds"]))
        self._pages["artifacts"].set_badge_number(0)
        self._render_header()

    def _render_header(self) -> None:
        project = self.project
        if project is None:
            return
        name = project.get("name") or project["id"]
        self._header.set_title(name)
        self._header.set_subtitle(detail_subtitle(project))
        if self.page is not None:
            self.page.set_title(name)
        confidential = confidential_badge(project)
        self._confidential.set_visible(confidential is not None)
        if confidential:
            self._confidential.update(*confidential)
        git = project.get("git")
        self._framework.set_label(framework_label(project.get("framework")))
        self._branch.set_visible(git is not None)
        self._branch.set_label((git or {}).get("branch") or GIT["detached"])
        sync = sync_label(git.get("ahead", 0), git.get("behind", 0)) if git else None
        self._sync.set_visible(bool(sync))
        self._sync.set_label(sync or "")
        dirty = dirty_badge(git, len(self._git.get("files", [])) if self._git else None)
        self._dirty.set_visible(dirty is not None)
        if dirty:
            self._dirty.update(*dirty)
        self._render_claude_account(project)
        activity = project_activity(self.project_id, self._lists["processes"], self._lists["builds"], self._runs)
        self._activity.set_visible(activity.kind != "idle")
        self._activity.update(activity.label, activity.tone)

    def _render_claude_account(self, project: Project) -> None:
        accounts = self._accounts
        self._account_picker.set_visible(accounts is not None)
        if accounts is not None:
            self._account_picker.set_options(
                claude_account_options(project, accounts), project_claude_account(project) or DEFAULT_CLAUDE_ACCOUNT
            )
        label = claude_account_label(project, accounts)
        self._claude_account.set_visible(accounts is not None and label is not None)
        self._claude_account.set_label(label or "")
