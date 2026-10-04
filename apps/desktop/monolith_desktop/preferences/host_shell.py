from gi.repository import Adw, Gtk

from ..hostshell import HostShellState
from ..strings import HOST_SHELL as S
from ..theme.icons import resolve_icon
from ..widgets.confirm_dialog import confirm
from .base import PreferencesPage

LOG_LINES = 40


def status_label(state: HostShellState) -> str:
    url = state.pairing.url if state.pairing else None
    if state.status == "running":
        return S["status_running"].format(url=url) if url else S["status_running_plain"]
    if state.status == "external":
        return S["status_external"].format(url=url or "")
    if state.status == "failed":
        return S["status_failed"].format(error=state.error or "")
    return S[f"status_{state.status}"]


def _row_button(label: str, on_click, destructive: bool = False) -> Gtk.Button:
    button = Gtk.Button(label=label, valign=Gtk.Align.CENTER)
    button.add_css_class("destructive-action" if destructive else "flat")
    button.connect("clicked", lambda *_: on_click())
    return button


class HostShellPreferences(PreferencesPage):
    id = "host-shell"
    order = 15

    def __init__(self, ctx, dialog) -> None:
        super().__init__(ctx, dialog, title=S["title"], icon=S["icon"])
        self._service = ctx.host_shell
        self._syncing = False

        refresh = Gtk.Button(icon_name=resolve_icon("refresh"), tooltip_text=S["refresh"], valign=Gtk.Align.CENTER)
        refresh.add_css_class("flat")
        refresh.connect("clicked", lambda *_: self._service.refresh())

        server = Adw.PreferencesGroup(title=S["server_group"], description=S["server_description"], header_suffix=refresh)
        self._serve = Adw.SwitchRow(title=S["serve"], use_markup=False)
        self._serve.connect("notify::active", self._on_serve)
        self._autostart = Adw.SwitchRow(title=S["autostart"], subtitle=S["autostart_subtitle"])
        self._autostart.connect("notify::active", self._on_autostart)
        server.add(self._serve)
        server.add(self._autostart)
        self.add(server)

        security = Adw.PreferencesGroup(title=S["security_group"])
        self._pin = Adw.ActionRow(title=S["pin"], use_markup=False)
        self._pin_button = _row_button(S["set_pin"], self._set_pin)
        self._pin.add_suffix(self._pin_button)
        token = Adw.ActionRow(title=S["token"], subtitle=S["token_subtitle"])
        token.add_suffix(_row_button(S["rotate"], self._rotate, destructive=True))
        security.add(self._pin)
        security.add(token)
        self.add(security)

        pairing = Adw.PreferencesGroup(title=S["pair_group"])
        pair = Adw.ActionRow(title=S["pair"], subtitle=S["pair_subtitle"])
        pair.add_suffix(_row_button(S["pair_button"], self._pair))
        pairing.add(pair)
        self._log_row = Adw.ExpanderRow(title=S["log"])
        self._log = Gtk.Label(xalign=0, wrap=True, selectable=True, css_classes=["monospace", "caption"])
        self._log.set_margin_top(8)
        self._log.set_margin_bottom(8)
        self._log.set_margin_start(12)
        self._log.set_margin_end(12)
        self._log_row.add_row(self._log)
        pairing.add(self._log_row)
        self.add(pairing)

        self._service.state.bind(self, self._render)
        self._service.refresh()

    def _render(self, state: HostShellState) -> None:
        self._syncing = True
        self._serve.set_active(state.serving or state.status == "starting")
        self._serve.set_sensitive(state.status not in ("stopping", "external"))
        self._serve.set_subtitle(status_label(state))
        self._autostart.set_active(state.autostart)
        self._syncing = False
        pin_set = state.pairing is not None and state.pairing.pin_set
        self._pin.set_subtitle(S["pin_set"] if pin_set else S["pin_missing"])
        self._pin_button.set_label(S["change_pin"] if pin_set else S["set_pin"])
        self._log.set_label("\n".join(state.log[-LOG_LINES:]) or S["log_empty"])

    def _on_serve(self, row: Adw.SwitchRow, _param) -> None:
        if self._syncing:
            return
        if row.get_active():
            self._service.start()
        else:
            self._service.stop()

    def _on_autostart(self, row: Adw.SwitchRow, _param) -> None:
        if not self._syncing:
            self._service.set_autostart(row.get_active())

    def _set_pin(self) -> None:
        from ..widgets.host_pin_dialog import HostPinDialog

        HostPinDialog(self.ctx, self.dialog).present(self.dialog)

    def _rotate(self) -> None:
        confirm(self.dialog, S["rotate_heading"], S["rotate_body"], S["rotate_confirm"], S["cancel"], self._do_rotate)

    def _do_rotate(self) -> None:
        self._service.rotate_token(
            lambda: self.dialog.add_toast(Adw.Toast(title=S["rotated"])),
            lambda error: self.dialog.add_toast(Adw.Toast(title=S["rotate_failed"].format(error=error), timeout=6)),
        )

    def _pair(self) -> None:
        from ..widgets.pair_dialog import PairDialog

        PairDialog(self.ctx, "host").present(self.dialog)


PREFERENCES_PAGE = HostShellPreferences
