from collections.abc import Callable
from typing import TYPE_CHECKING, Any

from gi.repository import Adw, Gtk

from ...api.client import ControllerClient
from ...api.errors import ControllerError, describe_error
from ...api.types import AgentRun, AppRun, ClaudeAccountList, GitDetails, Project, RunTargetInfo
from ...services.workspace import upsert
from ...util.format import join_meta
from ...widgets.buttons import ActionButton, IconButton
from ...widgets.choice_dropdown import ChoiceDropdown
from ...widgets.desktop import copy_text
from ...widgets.feedback import EmptyState, Notice
from ...widgets.lifecycle import while_mapped
from ...widgets.list_view import PillTabs, PropertyChip
from ...widgets.motion import crossfade_stack
from ...widgets.page_body import PageBody
from ...widgets.record_row import status_glyph
from ...widgets.text import Text
from .emulator import android_target, live_run, run_on_emulator, viewer
from .labels import CLAUDE_ACCOUNT, DETAIL, EMULATOR, GIT, TABS
from .model import (
    DEFAULT_CLAUDE_ACCOUNT,
    active_build_count,
    activity_glyph,
    claude_account_label,
    claude_account_options,
    confidential_badge,
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
from .remove_action import remove_project
from .rename_dialog import RenameProjectDialog
from .tab_artifacts import ArtifactsTab
from .tab_builds import BuildsTab
from .tab_conversations import ConversationsTab
from .tab_git import GitTab
from .tab_processes import ProcessesTab
from .tab_sync import SyncTab

if TYPE_CHECKING:
    from ...context import AppContext

REFRESH_INTERVAL_S = 15.0
BRANCH_CHARS = 40
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
        self._run_targets: list[RunTargetInfo] | None = None
        self._app_runs: list[AppRun] | None = None

        self.widget = crossfade_stack()
        self._state = EmptyState(DETAIL["loading"], loading=True)
        self.widget.add_named(self._state, LOADING)
        self.widget.add_named(self._build_content(), CONTENT)
        self._poller = ctx.poll(self._fetch, REFRESH_INTERVAL_S, self._loaded, self._failed).bind(self.widget)
        while_mapped(self.widget, self._attach)
        self._render()

    def _build_content(self) -> Gtk.Widget:
        body = PageBody(spacing=0)
        body.box.remove_css_class("to-page")
        body.box.add_css_class("to-detail-body")

        crumb = Gtk.Box(spacing=8, css_classes=["to-detail-crumb"])
        self._key = Text(self.project_id, "caption", "textTertiary")
        self._path = Text("", "code", "textTertiary")
        self._path.set_hexpand(True)
        self._path.set_selectable(True)
        crumb.append(self._key)
        crumb.append(self._path)
        for icon, label, callback in (
            ("copy", DETAIL["copy_path"], self._copy_path),
            ("rename", DETAIL["rename"], self._rename),
            ("delete", DETAIL["delete"], self._remove),
        ):
            button = IconButton(icon, label, callback)
            button.add_css_class("to-row-action")
            if icon == "delete":
                button.add_css_class("to-danger-button")
            crumb.append(button)
        body.append(crumb)

        self._title = Text(self.project_id, "h1", selectable=True)
        body.append(self._title)

        self._badges = Adw.WrapBox(child_spacing=6, line_spacing=6, css_classes=["to-detail-props"])
        self._activity = PropertyChip("status-todo")
        self._framework = PropertyChip("project")
        self._branch = PropertyChip("branch", max_chars=BRANCH_CHARS)
        self._sync = PropertyChip("sync")
        self._dirty = PropertyChip("status-progress")
        self._confidential = PropertyChip("confidential", icon_color="warning")
        self._claude_account = PropertyChip("agents")
        for badge in (
            self._activity, self._framework, self._branch, self._sync, self._dirty, self._confidential, self._claude_account
        ):
            self._badges.append(badge)
        body.append(self._badges)

        quick = Adw.WrapBox(child_spacing=8, line_spacing=8, css_classes=["to-detail-actions"])
        quick.append(ActionButton(DETAIL["ask"], self.ask_claude, "primary", "agents"))
        quick.append(ActionButton(DETAIL["claude_terminal"], lambda: self._terminal("claude"), "secondary", "terminal"))
        quick.append(ActionButton(DETAIL["shell"], lambda: self._terminal("shell"), "secondary", "terminal"))
        self._display_button = ActionButton(DETAIL["display"], self._display_action, "secondary", "display")
        quick.append(self._display_button)
        self._account_picker = ChoiceDropdown(on_change=self._set_claude_account, tooltip=CLAUDE_ACCOUNT["tooltip"])
        self._account_picker.set_visible(False)
        quick.append(self._account_picker)
        body.append(quick)

        self._notice = Notice("", tone="danger")
        self._notice.set_visible(False)
        self._notice.set_margin_top(12)
        self._notice.set_action(DETAIL["dismiss"], lambda: self._notice.set_visible(False))
        body.append(self._notice)

        self._stack = crossfade_stack(vhomogeneous=False, hhomogeneous=False, css_classes=["to-detail-tab"])
        self.git = GitTab()
        self.processes = ProcessesTab(self)
        self.builds = BuildsTab(self)
        self.artifacts = ArtifactsTab(self)
        self.conversations = ConversationsTab(self)
        self.sync_back = SyncTab(self, self._sync_count)
        tabs = {
            "processes": self.processes,
            "builds": self.builds,
            "artifacts": self.artifacts,
            "git": self.git,
            "sync": self.sync_back,
            "conversations": self.conversations,
        }
        for name, tab in tabs.items():
            self._stack.add_named(tab.widget, name)
        self._tabs = PillTabs([(name, TABS[name]) for name in tabs], "processes", self._stack.set_visible_child_name, DETAIL["tabs"])
        bar = Gtk.ScrolledWindow(
            child=self._tabs,
            vscrollbar_policy=Gtk.PolicyType.NEVER,
            hscrollbar_policy=Gtk.PolicyType.EXTERNAL,
            propagate_natural_height=True,
            css_classes=["to-detail-tabs"],
        )
        body.append(bar)
        body.append(self._stack)
        return body

    def header_widgets(self) -> list[Gtk.Widget]:
        return [IconButton("refresh", DETAIL["refresh"], self.refresh)]

    def _sync_count(self, count: int) -> None:
        if hasattr(self, "_tabs"):
            self._tabs.set_count("sync", count)

    def show_tab(self, name: str) -> None:
        if self._stack.get_child_by_name(name) is not None:
            self._tabs.select(name)

    def _attach(self) -> Callable[[], None]:
        detach = [
            self.ctx.subscribe(event, lambda message, key=key, kind=kind: self._event(kind, message.get(key)))
            for event, key, kind in EVENTS
        ]
        detach.append(self.ctx.subscribe("app.updated", lambda message: self._app_run_updated(message.get("run"))))
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
            "run_targets": None,
            "app_runs": None,
        }
        try:
            snapshot["run_targets"] = client.list_run_targets(self.project_id)
            snapshot["app_runs"] = client.list_app_runs(self.project_id)
        except ControllerError:
            pass
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
        self._run_targets = snapshot["run_targets"]
        self._app_runs = snapshot["app_runs"]
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

    def _app_run_updated(self, run: Any) -> None:
        if not isinstance(run, dict) or run.get("projectId") != self.project_id or self._app_runs is None:
            return
        self._app_runs = upsert(self._app_runs, run)
        self._render_display_button()

    def _display_action(self) -> None:
        target = android_target(self._run_targets)
        if target is None:
            self.ctx.navigate("display")
        elif not target["available"]:
            self.report(EMULATOR["unavailable"].format(reason=target["reason"]))
        else:
            self._display_button.set_sensitive(False)
            self.ctx.call(
                lambda client: run_on_emulator(client, self.project_id, target["target"]),
                self._on_emulator_run,
                lambda error: self.report(EMULATOR["failed"].format(error=describe_error(error))),
                lambda: self._display_button.set_sensitive(True),
            )

    def _on_emulator_run(self, result: tuple[AppRun, bool, str | None]) -> None:
        run, started, serial = result
        self._app_run_updated(run)
        if started:
            self.ctx.toast(EMULATOR["started"])
        if not viewer.installed():
            self.ctx.toast(EMULATOR["no_scrcpy"])
        elif serial is None:
            self.report(EMULATOR["no_serial"])
        else:
            name = (self.project or {}).get("name") or self.project_id
            viewer.open(serial, EMULATOR["title"].format(name=name), lambda error: self.report(EMULATOR["viewer_failed"].format(error=error)))

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

    def _rename(self) -> None:
        if self.project is not None:
            RenameProjectDialog(self.ctx, self.project).present()

    def _remove(self) -> None:
        if self.project is not None:
            remove_project(self.ctx, self.project, self.ctx.pop)

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
        self._tabs.set_count("processes", running_count(self._lists["processes"]))
        self._tabs.set_count("builds", active_build_count(self._lists["builds"]))
        self._tabs.set_count("artifacts", len(self._lists["artifacts"] or []))
        self._render_header()

    def _render_header(self) -> None:
        project = self.project
        if project is None:
            return
        name = project.get("name") or project["id"]
        self._title.set_label(name)
        self._key.set_label(project["id"])
        self._path.set_label(project.get("path") or "")
        if self.page is not None:
            self.page.set_title(name)
        confidential = confidential_badge(project)
        self._confidential.update(confidential[0] if confidential else None)
        git = project.get("git")
        self._framework.update(join_meta(framework_label(project.get("framework")), project.get("packageManager")))
        self._branch.update(((git or {}).get("branch") or GIT["detached"]) if git else None)
        self._sync.update(sync_label(git.get("ahead", 0), git.get("behind", 0)) if git else None)
        dirty = dirty_badge(git, len(self._git.get("files", [])) if self._git else None)
        if dirty:
            self._dirty.update(dirty[0], *status_glyph(dirty[1]))
        else:
            self._dirty.update(None)
        self._render_claude_account(project)
        self._render_display_button()
        activity = project_activity(self.project_id, self._lists["processes"], self._lists["builds"], self._runs)
        self._activity.update(activity.label, *activity_glyph(activity.kind))

    def _render_display_button(self) -> None:
        target = android_target(self._run_targets)
        if target is None:
            self._display_button.set_label_text(DETAIL["display"])
            self._display_button.set_icon("display")
            self._display_button.set_tooltip_text(None)
            return
        running = live_run(self._app_runs, target["target"]) is not None
        self._display_button.set_label_text(EMULATOR["show" if running else "run"])
        self._display_button.set_icon("smartphone")
        self._display_button.set_tooltip_text(
            (EMULATOR["tooltip_dir"].format(dir=target["dir"]) if target.get("dir") else EMULATOR["tooltip"])
            if target["available"]
            else target["reason"]
        )

    def _render_claude_account(self, project: Project) -> None:
        accounts = self._accounts
        self._account_picker.set_visible(accounts is not None)
        if accounts is not None:
            self._account_picker.set_options(
                claude_account_options(project, accounts), project_claude_account(project) or DEFAULT_CLAUDE_ACCOUNT
            )
        label = claude_account_label(project, accounts)
        self._claude_account.update(label if accounts is not None else None)
