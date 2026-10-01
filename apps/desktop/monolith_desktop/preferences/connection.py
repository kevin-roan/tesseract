from gi.repository import Adw

from ..config.model import ConnectionConfig
from ..config.storage import config_path
from ..pairing import normalize_base_url
from ..services.connection_view import connection_label, connection_tone
from ..store import ConnectionState
from ..strings import PREFERENCES as S
from ..strings import SOURCE_LABELS
from ..theme.icons import resolve_icon
from ..widgets.badges import StatusBadge
from .base import PreferencesPage


class ConnectionPreferences(PreferencesPage):
    id = "connection"
    order = 0

    def __init__(self, ctx, dialog) -> None:
        super().__init__(ctx, dialog, title=S["connection_title"], icon_name=S["connection_icon"])
        group = Adw.PreferencesGroup(title=S["sandbox_group"], description=S["sandbox_group_description"])
        self._url = Adw.EntryRow(title=S["api_url"])
        self._token = Adw.PasswordEntryRow(title=S["token"])
        self._name = Adw.EntryRow(title=S["name"])
        for row in (self._url, self._token, self._name):
            row.connect("entry-activated", lambda *_: self._on_save())
            group.add(row)
        self.add(group)

        status_group = Adw.PreferencesGroup(title=S["status_group"])
        self._status = Adw.ActionRow(title=S["status"])
        self._badge = StatusBadge("", "neutral")
        self._status.add_suffix(self._badge)
        self._source = Adw.ActionRow(title=S["source"], subtitle=S["config_file"].format(path=config_path()))
        self._source.set_subtitle_selectable(True)
        status_group.add(self._status)
        status_group.add(self._source)
        self.add(status_group)

        pairing = Adw.PreferencesGroup(title=S["pairing_group"], description=S["pairing_group_description"])
        self._pairing = Adw.EntryRow(title=S["pairing_url"])
        self._pairing.connect("entry-activated", lambda *_: self._on_save())
        pairing.add(self._pairing)
        self.add(pairing)

        actions = Adw.PreferencesGroup()
        self._save = Adw.ButtonRow(title=S["save"], start_icon_name=resolve_icon("success"), use_markup=False)
        self._save.add_css_class("suggested-action")
        self._rediscover = Adw.ButtonRow(title=S["rediscover"], start_icon_name=resolve_icon("search"))
        actions.add(self._save)
        actions.add(self._rediscover)
        self.add(actions)

        danger = Adw.PreferencesGroup()
        self._forget = Adw.ButtonRow(title=S["forget"])
        self._forget.add_css_class("destructive-action")
        danger.add(self._forget)
        self.add(danger)

        self._save.connect("activated", lambda *_: self._on_save())
        self._rediscover.connect("activated", lambda *_: self._on_rediscover())
        self._forget.connect("activated", lambda *_: self._on_forget())
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
