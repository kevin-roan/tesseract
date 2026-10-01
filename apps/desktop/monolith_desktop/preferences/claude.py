from gi.repository import Adw, Gtk

from ..api.tasks import Task, run_async
from ..api.types import ClaudeAuthStatus
from ..claude import model
from ..claude.host import HostClaudeState, read_host_state
from ..services.connection_view import connection_label
from ..store import ConnectionState
from ..strings import CLAUDE as S
from ..widgets import PreferenceRows
from .base import PreferencesPage


class ClaudePreferences(PreferencesPage):
    id = "claude"
    order = 10

    def __init__(self, ctx, dialog) -> None:
        super().__init__(ctx, dialog, title=S["title"], icon_name=S["icon"])
        self._status: ClaudeAuthStatus | None = None
        self._tasks: list[Task] = []
        self._was_online = False

        refresh = Gtk.Button(icon_name="view-refresh-symbolic", tooltip_text=S["refresh"], valign=Gtk.Align.CENTER)
        refresh.add_css_class("flat")
        refresh.connect("clicked", lambda *_: self._refresh())

        self._host_group = Adw.PreferencesGroup(title=S["host_group"])
        self._host_rows = PreferenceRows(self._host_group)
        self._host_rows.set_rows([(S["login"], S["loading"])])
        self.add(self._host_group)

        self._sandbox_group = Adw.PreferencesGroup(
            title=S["sandbox_group"], description=S["sandbox_description"], header_suffix=refresh
        )
        self._sandbox_rows = PreferenceRows(self._sandbox_group, selectable=True)
        self.add(self._sandbox_group)

        self.connect("destroy", lambda *_: self._cancel_tasks())
        self._load_host()
        ctx.store.connection.bind(self, self._render_connection)

    @property
    def _online(self) -> bool:
        return self.ctx.store.connection.value.online

    def _track(self, task: Task) -> None:
        self._tasks = [t for t in self._tasks if not t.done]
        self._tasks.append(task)

    def _cancel_tasks(self) -> None:
        for task in self._tasks:
            task.cancel()

    def _refresh(self) -> None:
        self._load_host()
        self._load_sandbox()

    def _load_host(self) -> None:
        self._track(run_async(read_host_state, on_success=self._render_host))

    def _render_host(self, state: HostClaudeState) -> None:
        self._host_group.set_description(S["host_description"].format(path=state.config_dir))
        self._host_rows.set_rows(model.host_rows(state))

    def _render_connection(self, state: ConnectionState) -> None:
        was_online, self._was_online = self._was_online, state.online
        if state.online:
            if not was_online:
                self._load_sandbox()
        else:
            self._render_sandbox(None, connection_label(state) + (f" — {state.error_message}" if state.error_message else ""))

    def _load_sandbox(self) -> None:
        if not self._online:
            return
        if self._status is None:
            self._sandbox_rows.set_rows([(S["status"], S["loading"])])
        self._track(
            self.ctx.call(
                lambda client: client.claude_auth(),
                on_success=self._render_sandbox,
                on_error=lambda error: self._render_sandbox(None, model.sandbox_error_message(error)),
            )
        )

    def _render_sandbox(self, status: ClaudeAuthStatus | None, message: str | None = None) -> None:
        self._status = status
        if status is None:
            self._sandbox_group.set_description(S["sandbox_description"])
            self._sandbox_rows.set_rows([(S["status"], message or S["disconnected"])])
        else:
            self._sandbox_group.set_description(f"{S['sandbox_description']} · {status['configDir']}")
            self._sandbox_rows.set_rows(model.sandbox_rows(status))


PREFERENCES_PAGE = ClaudePreferences
