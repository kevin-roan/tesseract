from gi.repository import Adw

from ..config.model import ConnectionConfig
from ..config.storage import config_path
from ..pairing import normalize_base_url
from ..services.connection_view import connection_label, connection_tone
from ..store import ConnectionState
from ..strings import PREFERENCES as S
from ..strings import SOURCE_LABELS
from ..widgets.badges import StatusBadge
from ..widgets.preference_rows import SettingsActions, button_row, entry_row
from .base import PreferencesPage


class ConnectionPreferences(PreferencesPage):
    id = "connection"
    order = 0

    def __init__(self, ctx, dialog) -> None:
        super().__init__(ctx, dialog, title=S["connection_title"], icon=S["connection_icon"])
        group = Adw.PreferencesGroup(title=S["sandbox_group"], description=S["sandbox_group_description"])
        url_row, self._url = entry_row(S["api_url"], on_activate=self._on_save)
        token_row, self._token = entry_row(S["token"], password=True, on_activate=self._on_save)
        name_row, self._name = entry_row(S["name"], on_activate=self._on_save)
        for row in (url_row, token_row, name_row):
            group.add(row)
        actions = SettingsActions()
        self._rediscover = actions.add(S["rediscover"], self._on_rediscover, icon="search")
        self._save = actions.add(S["save"], self._on_save, "primary")
        group.add(actions)
        self.add(group)

        pairing = Adw.PreferencesGroup(title=S["pairing_group"], description=S["pairing_group_description"])
        pairing_row, self._pairing = entry_row(S["pairing_url"], on_activate=self._on_save)
        pairing.add(pairing_row)
        self.add(pairing)

        status_group = Adw.PreferencesGroup(title=S["status_group"])
        self._status = Adw.ActionRow(title=S["status"])
        self._badge = StatusBadge("", "neutral")
        self._status.add_suffix(self._badge)
        self._source = Adw.ActionRow(title=S["source"], subtitle=S["config_file"].format(path=config_path()))
        self._source.set_subtitle_selectable(True)
        status_group.add(self._status)
        status_group.add(self._source)
        forget, _button = button_row(S["forget"], S["forget_subtitle"], S["forget_button"], self._on_forget, "destructive")
        status_group.add(forget)
        self.add(status_group)

        self._fill(ctx.connection.config)
        ctx.store.connection.bind(self, self._render_state)

    def _fill(self, config: ConnectionConfig | None) -> None:
        self._url.set_text(config.api_url if config else "")
        self._token.set_text(config.token if config else "")
        self._name.set_text(config.name or "" if config else "")
        self._pairing.set_text(config.pairing_url or "" if config else "")

    def _render_state(self, state: ConnectionState) -> None:
        self._badge.update(connection_label(state, with_name=False), connection_tone(state))
        self._status.set_subtitle(state.error_message or state.sandbox_name or "")
        source = SOURCE_LABELS.get(state.config.source, "") if state.config else ""
        self._source.set_title(f"{S['source']}: {source}" if source else S["source"])
        self._rediscover.set_sensitive(state.status != "discovering")

    def _read(self) -> ConnectionConfig | None:
        url = normalize_base_url(self._url.get_text())
        token = self._token.get_text().strip()
        if not url or not token:
            return None
        pairing = self._pairing.get_text().strip()
        return ConnectionConfig(
            api_url=url,
            token=token,
            name=self._name.get_text().strip() or None,
            pairing_url=normalize_base_url(pairing) if pairing else None,
            source="file",
            container=self.ctx.connection.config.container if self.ctx.connection.config else None,
        )

    def _on_save(self) -> None:
        config = self._read()
        if config is None:
            self.dialog.add_toast(Adw.Toast(title=S["invalid"]))
            return
        self.ctx.connection.save(config)
        self.dialog.add_toast(Adw.Toast(title=S["saved"]))

    def _on_rediscover(self) -> None:
        def done(result, error) -> None:
            if error is not None:
                self.dialog.add_toast(Adw.Toast(title=S["discovery_failed"].format(error=error), timeout=6))
                return
            self._fill(result.config)
            self.dialog.add_toast(Adw.Toast(title=S["discovered"].format(message=result.message), timeout=6))

        self.ctx.connection.rediscover(done)

    def _on_forget(self) -> None:
        self.ctx.connection.forget()
        self._fill(None)


PREFERENCES_PAGE = ConnectionPreferences
