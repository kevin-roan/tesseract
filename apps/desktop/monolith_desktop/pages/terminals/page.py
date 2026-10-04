from typing import Any

from gi.repository import Adw, Gio, GLib, Gtk

from ...api.errors import describe_error
from ...api.types import Project, TerminalInfo
from ...services.workspace import upsert
from ...store import ConnectionState
from ...theme.icons import resolve_icon
from ...widgets.badges import StatusBadge
from ...widgets.buttons import IconButton
from ...widgets.feedback import EmptyState, Notice
from ...widgets.icon import Icon
from ...widgets.motion import crossfade_stack
from ...widgets.text import Text
from ...widgets.terminal.view import estimate_grid
from ..base import Page
from . import model
from .components import LaunchButton, SessionRow
from .labels import ACTIONS, CONFIRM, EMPTY, ERRORS, LAUNCH, MENU, PLACEHOLDER, SIDEBAR, TITLE
from .session import TerminalSession

MAX_ATTACHED = 6
SIDEBAR_WIDTH = 300
SIDEBAR_MIN_WIDTH = 220
MIN_WIDTH = 280
MIN_HEIGHT = 240
COLLAPSE_CONDITION = "max-width: 560sp"
MENU_SECTIONS = (("copy", "paste", "select-all"), ("zoom-in", "zoom-out", "zoom-reset"), ("clear",))
REFRESH_ROWS_S = 30
EMPTY_ICONS = {"unconfigured": "sandbox", "offline": "offline", "unauthorized": "warning", "incompatible": "warning"}


class TerminalsPage(Page):
    id = "terminals"
    title = TITLE
    icon = "terminal"
    section = "sandbox"
    order = 30

    def __init__(self, ctx) -> None:
        super().__init__(ctx)
        self._sessions: dict[str, TerminalSession] = {}
        self._recent: list[str] = []
        self._rows: dict[str, SessionRow] = {}
        self._removed: set[str] = set()
        self._current: str | None = None
        self._launching = False
        self._syncing = False
        self._ticker: int | None = None
        self._launchers: list[LaunchButton] = []

    def build(self) -> Gtk.Widget:
        self._root = crossfade_stack()
        self._empty = EmptyState("")
        self._root.add_named(self._empty, "empty")

        self._split = Adw.OverlaySplitView(
            sidebar=self._build_sidebar(),
            content=self._build_content(),
            min_sidebar_width=SIDEBAR_MIN_WIDTH,
            max_sidebar_width=SIDEBAR_WIDTH,
            sidebar_width_fraction=0.3,
            css_classes=["to-terminal-split"],
        )
        self._split.connect("notify::collapsed", lambda *_: self._render_current())
        breakpoint = Adw.Breakpoint.new(Adw.BreakpointCondition.parse(COLLAPSE_CONDITION))
        breakpoint.add_setter(self._split, "collapsed", True)
        layout = Adw.BreakpointBin(child=self._split, width_request=MIN_WIDTH, height_request=MIN_HEIGHT)
        layout.add_breakpoint(breakpoint)
        self._root.add_named(layout, "main")

        store = self.ctx.store
        store.connection.bind(self._root, self._render_connection)
        store.terminals.bind(self._root, lambda _terminals: self._render_sessions())
        store.projects.bind(self._root, lambda _projects: self._render_sessions())
        self._root.connect("destroy", lambda *_: self._teardown())
        return self._root

    def on_shown(self) -> None:
        if self._ticker is None:
            self._ticker = GLib.timeout_add_seconds(REFRESH_ROWS_S, self._tick)
        session = self._session()
        if session is not None:
            GLib.idle_add(lambda: (session.view.focus(), GLib.SOURCE_REMOVE)[1])

    def on_hidden(self) -> None:
        if self._ticker is not None:
            GLib.source_remove(self._ticker)
            self._ticker = None

    def open(self, params: dict[str, Any]) -> None:
        request = model.parse_open(params)
        if isinstance(request, model.AttachRequest):
            self._removed.discard(request.terminal_id)
            self._select(request.terminal_id)
        elif isinstance(request, model.LaunchRequest):
            self._launch(request.kind, request.project_id)

    def _build_sidebar(self) -> Gtk.Widget:
        sidebar = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, css_classes=["to-terminal-sidebar"])
        launchers = Gtk.Box(spacing=8, homogeneous=True, css_classes=["to-terminal-launchers"])
        shell = LaunchButton(LAUNCH["shell"], "terminal", LAUNCH["shell_tooltip"], lambda pid: self._launch("shell", pid))
        claude = LaunchButton(LAUNCH["claude"], "agents", LAUNCH["claude_tooltip"], lambda pid: self._launch("claude", pid))
        self._launchers = [shell, claude]
        for launcher in self._launchers:
            self.ctx.store.projects.bind(launcher, launcher.set_projects)
            launchers.append(launcher)
        sidebar.append(launchers)
        heading = Gtk.Box(spacing=8, css_classes=["to-terminal-sidebar-heading"])
        title = Text(SIDEBAR["title"], "overline", "textTertiary")
        title.set_hexpand(True)
        heading.append(title)
        self._count = Text("", "caption", "textTertiary")
        heading.append(self._count)
        sidebar.append(heading)
        self._list = Gtk.ListBox(selection_mode=Gtk.SelectionMode.SINGLE, css_classes=["to-terminal-list"])
        self._list.connect("row-selected", self._row_selected)
        scroller = Gtk.ScrolledWindow(child=self._list, vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER)
        sidebar.append(scroller)
        self._sidebar_empty = Text(SIDEBAR["empty"], "caption", "textSecondary", wrap=True, lines=None)
        self._sidebar_empty.add_css_class("to-terminal-sidebar-empty")
        sidebar.append(self._sidebar_empty)
        return sidebar

    def _build_content(self) -> Gtk.Widget:
        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, hexpand=True, css_classes=["to-terminal-content"])
        self._toolbar = Gtk.Box(spacing=10, css_classes=["to-terminal-toolbar"])
        self._sidebar_toggle = IconButton("sidebar", ACTIONS["sessions"], lambda: self._split.set_show_sidebar(True))
        self._toolbar.append(self._sidebar_toggle)
        self._kind_icon = Icon("terminal", "md")
        titles = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True, valign=Gtk.Align.CENTER)
        self._titles = titles
        self._title = Text("", "bodyStrong")
        meta = Gtk.Box(spacing=8)
        self._badge = StatusBadge("")
        self._subtitle = Text("", "caption", "textSecondary")
        meta.append(self._badge)
        meta.append(self._subtitle)
        titles.append(self._title)
        titles.append(meta)
        self._toolbar.append(self._kind_icon)
        self._toolbar.append(titles)
        self._restart = IconButton("refresh", ACTIONS["restart"], self._restart_current)
        self._close = IconButton("close", ACTIONS["close"], self._close_current)
        self._toolbar.append(self._restart)
        self._toolbar.append(self._close)
        self._menu_owner = self._build_menu(content)
        self._toolbar.append(self._menu_owner)
        content.append(self._toolbar)

        self._views = Gtk.Stack(hexpand=True, vexpand=True, css_classes=["to-terminal-frame"])
        self._views.set_overflow(Gtk.Overflow.HIDDEN)
        self._placeholder = EmptyState(
            PLACEHOLDER["title"], PLACEHOLDER["message"], "terminal", False,
            PLACEHOLDER["shell"], lambda: self._launch("shell", None),
            PLACEHOLDER["claude"], lambda: self._launch("claude", None),
        )
        self._placeholder.add_css_class("to-terminal-placeholder")
        self._views.add_named(self._placeholder, "placeholder")
        overlay = Gtk.Overlay(child=self._views, css_classes=["to-terminal-stage"])
        self._banner = Notice("", tone="neutral")
        self._banner.set_valign(Gtk.Align.END)
        self._banner.add_css_class("to-terminal-banner")
        self._banner.set_visible(False)
        overlay.add_overlay(self._banner)
        content.append(overlay)
        return content

    def _build_menu(self, owner: Gtk.Widget) -> Gtk.Widget:
        group = Gio.SimpleActionGroup()
        handlers = {
            "copy": lambda view: view.copy(),
            "paste": lambda view: view.paste(),
            "select-all": lambda view: view.select_all(),
            "clear": lambda view: view.clear(),
            "zoom-in": lambda view: view.zoom(1),
            "zoom-out": lambda view: view.zoom(-1),
            "zoom-reset": lambda view: view.zoom(0),
        }
        for name, handler in handlers.items():
            action = Gio.SimpleAction.new(name, None)
            action.connect("activate", lambda _a, _p, fn=handler: self._with_view(fn))
            group.add_action(action)
        owner.insert_action_group("session", group)
        menu = Gio.Menu()
        for section in MENU_SECTIONS:
            items = Gio.Menu()
            for name in section:
                items.append(MENU[name], f"session.{name}")
            menu.append_section(None, items)
        button = Gtk.MenuButton(menu_model=menu, icon_name=resolve_icon("menu"), tooltip_text=ACTIONS["more"], valign=Gtk.Align.CENTER)
        button.add_css_class("flat")
        return button

    def _render_connection(self, state: ConnectionState) -> None:
        template = EMPTY.get(state.status)
        if state.online or template is None or self._sessions:
            self._root.set_visible_child_name("main")
            if state.online:
                for session in self._sessions.values():
                    if session.state in ("reconnecting", "closed"):
                        session.reconnect()
            return
        heading, message, action = template
        handler = None
        if action:
            handler = self.ctx.connection.refresh if state.status == "offline" else self.ctx.open_preferences
        self._empty.set_content(
            heading,
            message.format(error=state.error_message or "") if message else None,
            EMPTY_ICONS.get(state.status),
            state.status in ("discovering", "connecting"),
            action,
            handler,
        )
        self._root.set_visible_child_name("empty")

    def _terminals(self) -> list[TerminalInfo]:
        known = [t for t in self.ctx.store.terminals.value or [] if t["id"] not in self._removed]
        listed = {t["id"] for t in known}
        extra = [s.info for s in self._sessions.values() if s.id not in listed and s.info.get("createdAt")]
        return model.sort_sessions(known + extra)

    def _render_sessions(self) -> None:
        terminals = self._terminals()
        projects: list[Project] | None = self.ctx.store.projects.value
        for info in terminals:
            session = self._sessions.get(info["id"])
            if session is not None and info is not session.info:
                session.update_info(info)
        self._syncing = True
        while (child := self._list.get_first_child()) is not None:
            self._list.remove(child)
        self._rows = {}
        for info in terminals:
            row = SessionRow(self._row_model(info, projects), self._delete)
            self._rows[info["id"]] = row
            self._list.append(row)
        current = self._rows.get(self._current or "")
        if current is not None:
            self._list.select_row(current)
        self._syncing = False
        running = sum(1 for t in terminals if t.get("state") == "running")
        self._count.set_label(str(running) if running else "")
        self._sidebar_empty.set_visible(not terminals)
        self._render_current()

    def _row_model(self, info: TerminalInfo, projects: list[Project] | None) -> model.RowModel:
        row = model.row_model(info, projects)
        session = self._sessions.get(info["id"])
        if session is None:
            return row
        status, tone = model.state_badge(session.state, session.exit_code)
        running = session.state != "exited" and row.running
        return model.RowModel(row.id, row.icon, row.title, row.subtitle, status, tone, running)

    def _tick(self) -> bool:
        self._render_sessions()
        return GLib.SOURCE_CONTINUE

    def _row_selected(self, _list: Gtk.ListBox, row: Gtk.ListBoxRow | None) -> None:
        if self._syncing or not isinstance(row, SessionRow):
            return
        if row.terminal_id != self._current:
            self._select(row.terminal_id)

    def _session(self) -> TerminalSession | None:
        return self._sessions.get(self._current) if self._current else None

    def _select(self, terminal_id: str) -> None:
        session = self._sessions.get(terminal_id)
        if session is None:
            info = next((t for t in self.ctx.store.terminals.value or [] if t["id"] == terminal_id), None)
            session = TerminalSession(self.ctx, model.merge_info(info, terminal_id), self._session_changed)
            self._sessions[terminal_id] = session
            self._views.add_named(session.view, terminal_id)
            session.attach()
        if terminal_id in self._recent:
            self._recent.remove(terminal_id)
        self._recent.append(terminal_id)
        self._current = terminal_id
        self._evict()
        self._views.set_visible_child(session.view)
        if self._split.get_collapsed():
            self._split.set_show_sidebar(False)
        self._render_sessions()
        session.view.focus()

    def _evict(self) -> None:
        while len(self._sessions) > MAX_ATTACHED:
            victim = next((tid for tid in self._recent if tid != self._current), None)
            if victim is None:
                return
            self._detach(victim)

    def _detach(self, terminal_id: str) -> None:
        session = self._sessions.pop(terminal_id, None)
        if terminal_id in self._recent:
            self._recent.remove(terminal_id)
        if session is None:
            return
        session.detach()
        self._views.remove(session.view)

    def _session_changed(self, session: TerminalSession) -> None:
        row = self._rows.get(session.id)
        if row is not None:
            row.update(self._row_model(session.info, self.ctx.store.projects.value))
        if session.id == self._current:
            self._render_current()

    def _render_current(self) -> None:
        session = self._session()
        collapsed = self._split.get_collapsed()
        self._sidebar_toggle.set_visible(collapsed)
        self._toolbar.set_visible(session is not None or collapsed)
        for widget in (self._kind_icon, self._titles, self._restart, self._close, self._menu_owner):
            widget.set_visible(session is not None)
        if session is None:
            self._views.set_visible_child(self._placeholder)
            self._banner.set_visible(False)
            return
        info = session.info
        self._kind_icon.set_icon(model.kind_icon(info["kind"]))
        self._title.set_label(model.session_title(info, self.ctx.store.projects.value))
        self._subtitle.set_text_value(session.window_title or info.get("cwd") or None)
        self._badge.update(*model.state_badge(session.state, session.exit_code))
        exited = session.state == "exited"
        self._restart.set_visible(exited)
        self._close.set_tooltip_text(ACTIONS["remove"] if exited else ACTIONS["close"])
        banner = model.banner(session.state, session.exit_code, session.error)
        self._banner.set_visible(banner is not None)
        if banner is not None:
            self._banner.update(banner.message, banner.title, banner.tone)
            label = ACTIONS.get(banner.action or "")
            self._banner.set_action(label, self._banner_handler(banner.action))

    def _banner_handler(self, action: str | None):
        if action == "restart":
            return self._restart_current
        if action == "reconnect":
            return lambda: self._with_session(lambda session: session.reconnect())
        return None

    def _with_session(self, fn) -> None:
        session = self._session()
        if session is not None:
            fn(session)

    def _with_view(self, fn) -> None:
        session = self._session()
        if session is not None:
            fn(session.view)
            session.view.focus()

    def _grid(self) -> tuple[int, int]:
        session = self._session()
        if session is not None and session.view.grid_known:
            return session.view.grid
        return estimate_grid(self._views)

    def _launch(self, kind: str, project_id: str | None) -> None:
        if self._launching:
            return
        self._set_launching(True)
        cols, rows = self._grid()
        self.ctx.call(
            lambda client: client.create_terminal(kind, cols, rows, project_id),
            on_success=self._launched,
            on_error=lambda error: self.ctx.toast(ERRORS["create"].format(error=describe_error(error))),
            on_done=lambda: self._set_launching(False),
        )

    def _set_launching(self, launching: bool) -> None:
        self._launching = launching
        for launcher in self._launchers:
            launcher.set_sensitive(not launching)
        self._placeholder.set_sensitive(not launching)

    def _launched(self, info: TerminalInfo) -> None:
        self.ctx.store.terminals.update(lambda items: upsert(items, info))
        self._select(info["id"])

    def _restart_current(self) -> None:
        session = self._session()
        if session is not None:
            self._launch(session.info["kind"], session.info.get("projectId"))

    def _close_current(self) -> None:
        if self._current is not None:
            self._delete(self._current)

    def _delete(self, terminal_id: str) -> None:
        session = self._sessions.get(terminal_id)
        info = session.info if session is not None else next(
            (t for t in self._terminals() if t["id"] == terminal_id), None
        )
        if info is None:
            return
        if info.get("state") == "exited" or (session is not None and session.state == "exited"):
            self._remove(terminal_id)
            return
        title = model.session_title(info, self.ctx.store.projects.value)
        dialog = Adw.AlertDialog(heading=CONFIRM["heading"], body=CONFIRM["body"].format(title=title))
        dialog.add_response("cancel", CONFIRM["cancel"])
        dialog.add_response("close", CONFIRM["close"])
        dialog.set_response_appearance("close", Adw.ResponseAppearance.DESTRUCTIVE)
        dialog.set_default_response("cancel")
        dialog.set_close_response("cancel")
        dialog.connect("response", lambda _d, response: self._remove(terminal_id) if response == "close" else None)
        dialog.present(self._root)

    def _remove(self, terminal_id: str) -> None:
        self.ctx.call(
            lambda client: client.close_terminal(terminal_id),
            on_success=lambda _info: self._removed_session(terminal_id),
            on_error=lambda error: self.ctx.toast(ERRORS["close"].format(error=describe_error(error))),
        )

    def _removed_session(self, terminal_id: str) -> None:
        self._removed.add(terminal_id)
        self._detach(terminal_id)
        self.ctx.store.terminals.update(
            lambda items: None if items is None else [t for t in items if t["id"] != terminal_id]
        )
        if self._current == terminal_id:
            self._current = None
            following = next((t["id"] for t in self._terminals() if t["id"] in self._sessions), None)
            if following is not None:
                self._select(following)
                return
        self._render_sessions()

    def _teardown(self) -> None:
        self.on_hidden()
        for terminal_id in list(self._sessions):
            self._detach(terminal_id)
