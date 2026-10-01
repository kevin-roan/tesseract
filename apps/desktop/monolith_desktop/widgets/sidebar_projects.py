from collections.abc import Callable
from typing import TYPE_CHECKING

from gi.repository import Adw, Gtk

from ..strings import SIDEBAR
from ..theme.tokens import SIDEBAR_RUN_INDENT
from ..util.format import format_relative_time
from .icon import Icon
from .sidebar_model import ProjectItem, RunItem, WorkspaceState, project_items, workspace_state
from .text import Text
from .tone import ToneBinding

if TYPE_CHECKING:
    from ..context import AppContext

ProjectKey = str | None


class ActivityIndicator(Gtk.Stack):
    def __init__(self, idle_icon: str | None = None, size: int = 14) -> None:
        super().__init__(valign=Gtk.Align.CENTER, halign=Gtk.Align.CENTER, css_classes=["to-side-indicator"])
        self.set_size_request(size, size)
        self._spinner = Adw.Spinner(width_request=size, height_request=size)
        self.add_named(self._spinner, "running")
        if idle_icon:
            self._idle: Gtk.Widget = Icon(idle_icon, "sm", "textSecondary")
        else:
            self._idle = Gtk.Box(valign=Gtk.Align.CENTER, halign=Gtk.Align.CENTER, css_classes=["to-tone-dot"])
        self._tone = ToneBinding("neutral", self._idle)
        self.add_named(self._idle, "idle")

    def update(self, running: bool, tone: str = "neutral") -> None:
        self.set_visible_child_name("running" if running else "idle")
        self._tone.set(tone)


class RunButton(Gtk.Button):
    def __init__(self, on_open: Callable[[str], None]) -> None:
        super().__init__(css_classes=["to-side-run"], margin_start=SIDEBAR_RUN_INDENT)
        self._id = ""
        self._indicator = ActivityIndicator(size=12)
        self._title = Text("", "bodySmall", "textSecondary")
        self._title.set_hexpand(True)
        self._time = Text("", "caption", "textTertiary")
        box = Gtk.Box(spacing=8)
        for widget in (self._indicator, self._title, self._time):
            box.append(widget)
        self.set_child(box)
        self.connect("clicked", lambda *_: on_open(self._id))

    def update(self, run: RunItem) -> None:
        self._id = run.id
        title = run.title or SIDEBAR["untitled_run"]
        self._title.set_label(title)
        self.set_tooltip_text(title)
        self._time.set_text_value(format_relative_time(run.started_at))
        self._indicator.update(run.running, run.tone)
        if run.running:
            self.add_css_class("running")
        else:
            self.remove_css_class("running")


class ProjectEntry(Gtk.Box):
    def __init__(
        self,
        key: ProjectKey,
        on_project: Callable[[ProjectKey], None],
        on_new: Callable[[ProjectKey], None],
        on_run: Callable[[str], None],
        on_toggle: Callable[[ProjectKey, bool], None],
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-side-project"])
        self.key = key
        self._on_run = on_run
        self._on_toggle = on_toggle
        self._name = ""

        self._indicator = ActivityIndicator("project" if key else "agents", 16)
        self._label = Text("", "label", "text")
        self._label.set_hexpand(True)
        self._running = Text("", "caption")
        self._running.add_css_class("to-side-running")
        self._running.set_valign(Gtk.Align.CENTER)
        self._running.set_xalign(0.5)
        main_box = Gtk.Box(spacing=10)
        for widget in (self._indicator, self._label, self._running):
            main_box.append(widget)
        self._main = Gtk.Button(child=main_box, hexpand=True, css_classes=["to-side-row-main"])
        self._main.connect("clicked", lambda *_: on_project(key) if key else self._toggle())

        self._add = Gtk.Button(child=Icon("add", "xs"), css_classes=["to-side-row-action", "to-side-add"], valign=Gtk.Align.CENTER)
        self._add.connect("clicked", lambda *_: on_new(key))
        self._chevron_icon = Icon("collapse", "xs")
        self._chevron = Gtk.Button(child=self._chevron_icon, css_classes=["to-side-row-action"], valign=Gtk.Align.CENTER)
        self._chevron.connect("clicked", lambda *_: self._toggle())

        row = Gtk.Box(css_classes=["to-side-row"])
        for widget in (self._main, self._add, self._chevron):
            row.append(widget)
        self.append(row)

        self._runs = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=1, css_classes=["to-side-runs"])
        self._empty = Text(SIDEBAR["no_runs"], "caption", "textTertiary")
        self._empty.set_margin_start(SIDEBAR_RUN_INDENT + 10)
        self._empty.add_css_class("to-side-empty-runs")
        self._runs.append(self._empty)
        self._run_buttons: list[RunButton] = []
        self._revealer = Gtk.Revealer(child=self._runs, reveal_child=False)
        self.append(self._revealer)

    @property
    def expanded(self) -> bool:
        return self._revealer.get_reveal_child()

    def set_expanded(self, expanded: bool) -> None:
        self._revealer.set_reveal_child(expanded)
        self._chevron_icon.set_icon("expand" if expanded else "collapse")
        tooltip = SIDEBAR["collapse" if expanded else "expand"]
        self._chevron.set_tooltip_text(tooltip)
        self._chevron.update_property([Gtk.AccessibleProperty.LABEL], [tooltip])

    def update(self, item: ProjectItem) -> None:
        if item.name != self._name:
            self._name = item.name
            self._label.set_label(item.name)
            open_label = SIDEBAR["open_project"].format(name=item.name) if item.id else item.name
            self._main.set_tooltip_text(open_label)
            self._add.set_tooltip_text(SIDEBAR["new_in_project"].format(name=item.name))
            self._add.update_property([Gtk.AccessibleProperty.LABEL], [SIDEBAR["new_in_project"].format(name=item.name)])
        self._indicator.update(item.active, "info" if item.active else "neutral")
        self._running.set_text_value(str(item.running) if item.running else None)
        self._running.set_tooltip_text(SIDEBAR["running"].format(count=item.running) if item.running else None)
        self._sync_runs(item.runs)

    def _sync_runs(self, runs: tuple[RunItem, ...]) -> None:
        while len(self._run_buttons) < len(runs):
            button = RunButton(self._on_run)
            self._run_buttons.append(button)
            self._runs.append(button)
        for index, button in enumerate(self._run_buttons):
            visible = index < len(runs)
            button.set_visible(visible)
            if visible:
                button.update(runs[index])
        self._empty.set_visible(not runs)

    def _toggle(self) -> None:
        self.set_expanded(not self.expanded)
        self._on_toggle(self.key, self.expanded)


class SidebarProjects(Gtk.Box):
    def __init__(self, ctx: "AppContext", on_project_selected: Callable[[str | None], None] | None = None) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=2, css_classes=["to-side-projects"])
        self._ctx = ctx
        self._on_project_selected = on_project_selected
        self._entries: dict[ProjectKey, ProjectEntry] = {}
        self._expanded: dict[ProjectKey, bool] = {}

        header = Gtk.Box(spacing=4, css_classes=["to-side-section"])
        title = Text(SIDEBAR["projects"], "overline", "textTertiary")
        title.set_hexpand(True)
        header.append(title)
        create = Gtk.Button(child=Icon("add", "xs"), css_classes=["to-side-row-action"], tooltip_text=SIDEBAR["new_project"])
        create.update_property([Gtk.AccessibleProperty.LABEL], [SIDEBAR["new_project"]])
        create.connect("clicked", lambda *_: ctx.navigate("projects", {"create": True}))
        header.append(create)
        self._create = create
        self.append(header)

        self._status = Gtk.Box(spacing=10, css_classes=["to-side-status"])
        self._spinner = Adw.Spinner(width_request=14, height_request=14)
        self._message = Text("", "caption", "textTertiary", wrap=True, lines=3)
        self._message.set_hexpand(True)
        self._status.append(self._spinner)
        self._status.append(self._message)
        self._status_action = Gtk.Button(label=SIDEBAR["create_project"], css_classes=["to-side-link"], halign=Gtk.Align.START)
        self._status_action.connect("clicked", lambda *_: ctx.navigate("projects", {"create": True}))
        self.append(self._status)
        self.append(self._status_action)

        self._list = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=1)
        self.append(self._list)

        ctx.store.projects.bind(self, lambda _value: self._render())
        ctx.store.agent_runs.bind(self, lambda _value: self._render())
        ctx.store.connection.bind(self, lambda _value: self._render())

    def _render(self) -> None:
        store = self._ctx.store
        online = store.connection.value.online
        projects = store.projects.value
        items = project_items(projects, store.agent_runs.value, SIDEBAR["no_project"]) if projects is not None else []
        state = workspace_state(online, projects, len(items))
        self._show_state(state)
        self._create.set_sensitive(online)
        self._reconcile(items if state == "ready" else [])

    def _show_state(self, state: WorkspaceState) -> None:
        messages = {"loading": SIDEBAR["loading"], "offline": SIDEBAR["offline"], "empty": SIDEBAR["empty"]}
        self._status.set_visible(state in messages)
        self._spinner.set_visible(state == "loading")
        self._message.set_label(messages.get(state, ""))
        self._status_action.set_visible(state == "empty")

    def _reconcile(self, items: list[ProjectItem]) -> None:
        keys = [item.id for item in items]
        for key in [key for key in self._entries if key not in keys]:
            self._list.remove(self._entries.pop(key))
        previous: Gtk.Widget | None = None
        for item in items:
            entry = self._entries.get(item.id)
            if entry is None:
                entry = ProjectEntry(item.id, self._open_project, self._new_conversation, self._open_run, self._toggled)
                self._entries[item.id] = entry
                self._list.append(entry)
                entry.set_expanded(self._expanded.get(item.id, item.active))
            elif item.active and item.id not in self._expanded:
                entry.set_expanded(True)
            entry.update(item)
            self._list.reorder_child_after(entry, previous)
            previous = entry

    def _toggled(self, key: ProjectKey, expanded: bool) -> None:
        self._expanded[key] = expanded

    def _open_project(self, key: ProjectKey) -> None:
        if key is None:
            return
        if self._on_project_selected:
            self._on_project_selected(key)
        self._ctx.navigate("projects", {"projectId": key})

    def _new_conversation(self, key: ProjectKey) -> None:
        if self._on_project_selected:
            self._on_project_selected(key)
        params = {"new": True, "projectId": key} if key else {"new": True}
        self._ctx.navigate("agents", params)

    def _open_run(self, run_id: str) -> None:
        self._ctx.navigate("agents", {"runId": run_id})
