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
from ..widgets.preference_rows import SettingsActions, entry_row
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

        gemini_group = Adw.PreferencesGroup(title=S["gemini_group"], description=S["gemini_description"])
        self._key_row, self._gemini_key = entry_row(S["gemini_key"], password=True, on_activate=self._on_save_key)
        gemini_group.add(self._key_row)
        actions = SettingsActions()
        self._remove_key = actions.add(S["gemini_remove"], self._on_remove_key, "destructive")
        self._save_key = actions.add(S["save"], self._on_save_key, "primary")
        gemini_group.add(actions)
        self.add(gemini_group)

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
        self._gemini_key.set_sensitive(status is not None and not self._pending)
        self._save_key.set_sensitive(status is not None and not self._pending)
        self._remove_key.set_visible(status is not None and status["gemini"]["source"] == "settings")
        self._remove_key.set_sensitive(not self._pending)
        if status is None:
            self._status_rows.set_rows([(S["status"], message or S["disconnected"])])
        else:
            self._status_rows.set_rows(model.status_rows(status))
        self._key_row.set_subtitle(model.gemini_subtitle(status))

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

    def _on_save_key(self) -> None:
        key = self._gemini_key.get_text().strip()
        if not key or self._status is None or self._pending:
            return
        self._update_key(key)

    def _on_remove_key(self) -> None:
        if self._status is not None and not self._pending:
            self._update_key(None)

    def _update_key(self, key: str | None) -> None:
        self._pending = True
        self._render(self._status)
        self._track(
            self.ctx.call(
                lambda client: client.set_gemini_api_key(key),
                on_success=lambda status: self._on_key_changed(status, key is not None),
                on_error=lambda error: self.dialog.add_toast(
                    Adw.Toast(title=S["gemini_failed"].format(error=describe_error(error)), timeout=6)
                ),
                on_done=self._on_change_done,
            )
        )

    def _on_key_changed(self, status: SttStatus, saved: bool) -> None:
        self._status = status
        self._gemini_key.set_text("")
        self.dialog.add_toast(Adw.Toast(title=S["gemini_saved"] if saved else S["gemini_removed"]))

    def _on_changed(self, status: SttStatus) -> None:
        self._status = status
        self.dialog.add_toast(Adw.Toast(title=S["changed"].format(profile=model.profile_title(status["profile"]))))

    def _on_change_failed(self, error: BaseException) -> None:
        self.dialog.add_toast(Adw.Toast(title=S["change_failed"].format(error=describe_error(error)), timeout=6))

    def _on_change_done(self) -> None:
        self._pending = False
        self._render(self._status)


PREFERENCES_PAGE = SttPreferences
