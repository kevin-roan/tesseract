from gi.repository import Adw, Gtk

from ..api.errors import describe_error
from ..api.tasks import Task
from ..api.types import STT_PROFILES, SttStatus
from ..services.connection_view import connection_label
from ..store import ConnectionState
from ..strings import STT as S
from ..stt import model
from ..widgets import PreferenceRows
from ..widgets.buttons import IconButton
from .base import PreferencesPage


class SttPreferences(PreferencesPage):
    id = "stt"
    order = 20

    def __init__(self, ctx, dialog) -> None:
        super().__init__(ctx, dialog, title=S["title"], icon=S["icon"])
        self._status: SttStatus | None = None
        self._tasks: list[Task] = []
        self._was_online = False
        self._pending = False
        self._syncing = False

        refresh = IconButton("refresh", S["refresh"], lambda: self._load())

        profiles_group = Adw.PreferencesGroup(title=S["profiles_group"], description=S["profiles_description"])
        self._rows: dict[str, Adw.ActionRow] = {}
        self._checks: dict[str, Gtk.CheckButton] = {}
        group: Gtk.CheckButton | None = None
        for profile in STT_PROFILES:
            check = Gtk.CheckButton(valign=Gtk.Align.CENTER, group=group)
            check.connect("toggled", self._on_toggled, profile)
            group = group or check
            row = Adw.ActionRow(use_markup=False, activatable_widget=check)
            row.add_prefix(check)
            profiles_group.add(row)
            self._rows[profile] = row
            self._checks[profile] = check
        self.add(profiles_group)

        self._status_group = Adw.PreferencesGroup(title=S["status_group"], header_suffix=refresh)
        self._status_rows = PreferenceRows(self._status_group, selectable=True)
        self.add(self._status_group)

        self.connect("destroy", lambda *_: self._cancel_tasks())
        self._render(None, S["loading"])
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

    def _render_connection(self, state: ConnectionState) -> None:
        was_online, self._was_online = self._was_online, state.online
        if state.online:
            if not was_online:
                self._load()
        else:
            self._render(None, connection_label(state) + (f" — {state.error_message}" if state.error_message else ""))

    def _load(self) -> None:
        if not self._online:
            return
        if self._status is None:
            self._status_rows.set_rows([(S["status"], S["loading"])])
        self._track(
            self.ctx.call(
                lambda client: client.stt_status(),
                on_success=self._render,
                on_error=lambda error: self._render(None, model.status_error_message(error)),
            )
        )

    def _render(self, status: SttStatus | None, message: str | None = None) -> None:
        self._status = status
        self._syncing = True
        for choice in model.profile_choices(status):
            row = self._rows[choice.id]
            row.set_title(choice.title)
            row.set_subtitle(choice.subtitle)
            row.set_sensitive(status is not None and choice.available and not self._pending)
            self._checks[choice.id].set_active(status is not None and status["profile"] == choice.id)
        self._syncing = False
        if status is None:
            self._status_rows.set_rows([(S["status"], message or S["disconnected"])])
        else:
            self._status_rows.set_rows(model.status_rows(status))

    def _on_toggled(self, check: Gtk.CheckButton, profile: str) -> None:
        if self._syncing or not check.get_active() or self._status is None or self._status["profile"] == profile:
            return
        self._pending = True
        self._render(self._status)
        self._track(
            self.ctx.call(
                lambda client: client.set_stt_profile(profile),
                on_success=self._on_changed,
                on_error=self._on_change_failed,
                on_done=self._on_change_done,
            )
        )

    def _on_changed(self, status: SttStatus) -> None:
        self._status = status
        self.dialog.add_toast(Adw.Toast(title=S["changed"].format(profile=model.profile_title(status["profile"]))))

    def _on_change_failed(self, error: BaseException) -> None:
        self.dialog.add_toast(Adw.Toast(title=S["change_failed"].format(error=describe_error(error)), timeout=6))

    def _on_change_done(self) -> None:
        self._pending = False
        self._render(self._status)


PREFERENCES_PAGE = SttPreferences
