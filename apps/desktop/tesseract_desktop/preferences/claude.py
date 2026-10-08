from gi.repository import Adw, GLib

from ..api.tasks import Task, run_async
from ..api.types import ClaudeAccountList, ClaudeAuthStatus
from ..claude import model
from ..claude.host import HostClaudeState, read_host_states
from ..services.connection_view import connection_label
from ..store import ConnectionState
from ..strings import CLAUDE as S
from ..widgets import PreferenceRows, RadioRows
from ..widgets.buttons import IconButton
from .base import PreferencesPage


class ClaudePreferences(PreferencesPage):
    id = "claude"
    order = 10

    def __init__(self, ctx, dialog) -> None:
        super().__init__(ctx, dialog, title=S["title"], icon=S["icon"])
        self._status: ClaudeAuthStatus | None = None
        self._accounts: ClaudeAccountList | None = None
        self._host_accounts: dict[str, tuple[Adw.ExpanderRow, PreferenceRows]] = {}
        self._pending = False
        self._tasks: list[Task] = []
        self._was_online = False

        refresh = IconButton("refresh", S["refresh"], lambda: self._refresh())

        self._host_group = Adw.PreferencesGroup(title=S["host_group"], description=S["loading"])
        self.add(self._host_group)

        self._sandbox_group = Adw.PreferencesGroup(
            title=S["sandbox_group"], description=S["sandbox_description"], header_suffix=refresh
        )
        self._sandbox_rows = PreferenceRows(self._sandbox_group, selectable=True)
        self.add(self._sandbox_group)

        self._accounts_group = Adw.PreferencesGroup(title=S["accounts_group"], description=S["accounts_description"])
        self._accounts_message = PreferenceRows(self._accounts_group)
        self._account_rows = RadioRows(self._accounts_group, self._on_default_selected)
        self.add(self._accounts_group)

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
        self._track(run_async(read_host_states, on_success=self._render_host))

    def _render_host(self, states: list[HostClaudeState]) -> None:
        self._host_group.set_description(GLib.markup_escape_text(S["host_description"]))
        ids = [state.account_id for state in states]
        for account_id in [account_id for account_id in self._host_accounts if account_id not in ids]:
            self._host_group.remove(self._host_accounts.pop(account_id)[0])
        for state in states:
            if state.account_id not in self._host_accounts:
                expander = Adw.ExpanderRow(use_markup=False, expanded=not self._host_accounts)
                self._host_group.add(expander)
                self._host_accounts[state.account_id] = (expander, PreferenceRows(expander))
            expander, rows = self._host_accounts[state.account_id]
            expander.set_title(state.account_id)
            expander.set_subtitle(model.host_account_subtitle(state))
            rows.set_rows(model.host_rows(state))

    def _render_connection(self, state: ConnectionState) -> None:
        was_online, self._was_online = self._was_online, state.online
        if state.online:
            if not was_online:
                self._load_sandbox()
        else:
            message = connection_label(state) + (f" — {state.error_message}" if state.error_message else "")
            self._render_sandbox(None, message)
            self._render_accounts(None, message)

    def _load_sandbox(self) -> None:
        if not self._online:
            return
        if self._status is None:
            self._sandbox_rows.set_rows([(S["status"], S["loading"])])
        if self._accounts is None:
            self._accounts_message.set_rows([(S["status"], S["loading"])])
        self._track(
            self.ctx.call(
                lambda client: client.claude_accounts(),
                on_success=self._render_accounts,
                on_error=lambda error: self._render_accounts(None, model.sandbox_error_message(error, "accounts_outdated")),
            )
        )
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

    def _render_accounts(self, accounts: ClaudeAccountList | None, message: str | None = None) -> None:
        self._accounts = accounts
        if accounts is None:
            self._accounts_message.set_rows([(S["status"], message or S["disconnected"])])
        else:
            self._accounts_message.set_rows([] if accounts["accounts"] else [(S["status"], S["accounts_empty"])])
        self._account_rows.set_choices(
            model.account_choices(accounts), accounts["defaultAccountId"] if accounts else None, self._pending
        )

    def _on_default_selected(self, account_id: str) -> None:
        if self._accounts is None or self._accounts["defaultAccountId"] == account_id:
            return
        self._pending = True
        self._render_accounts(self._accounts)
        self._track(
            self.ctx.call(
                lambda client: client.set_default_claude_account(account_id),
                on_success=self._on_default_changed,
                on_error=self._on_default_change_failed,
                on_done=self._on_default_change_done,
            )
        )

    def _on_default_changed(self, accounts: ClaudeAccountList) -> None:
        self._accounts = accounts
        self.dialog.add_toast(Adw.Toast(title=S["default_changed"].format(id=accounts["defaultAccountId"])))
        self._load_sandbox()
        self.ctx.workspace.refresh()

    def _on_default_change_failed(self, error: BaseException) -> None:
        message = model.sandbox_error_message(error, "accounts_outdated")
        self.dialog.add_toast(Adw.Toast(title=S["default_change_failed"].format(error=message), timeout=6))

    def _on_default_change_done(self) -> None:
        self._pending = False
        self._render_accounts(self._accounts)


PREFERENCES_PAGE = ClaudePreferences
