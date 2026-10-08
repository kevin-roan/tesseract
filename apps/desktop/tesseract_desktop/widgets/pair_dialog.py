from collections.abc import Callable

from gi.repository import Adw, Gtk

from ..context import AppContext
from ..hostshell import HostShellState
from ..pairing import PairingError
from ..store import ConnectionState
from ..strings import PAIR
from .code_block import copy_to_clipboard
from .dialog import CopyField, DialogShell
from .feedback import Notice
from .qr import QrCode
from .segmented import SegmentedControl
from .text import Text

DIALOG_WIDTH = 440
QR_SIZE = 176
SANDBOX = "sandbox"
HOST = "host"
TARGET_ICONS = {SANDBOX: "sandbox", HOST: "host"}


class PairPanel(Gtk.Box):
    """QR code, deep link and caption for one pairing target, with notices above the secret warning."""

    def __init__(self, instructions: str, secret: str, on_copy: Callable[[str], None]) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=12, css_classes=["to-pair-panel"])
        self.link: str | None = None
        self._qr = QrCode(size=QR_SIZE)
        self._qr.set_margin_bottom(4)
        self._instructions = Text(instructions, "body", "textSecondary", wrap=True, lines=None, center=True)
        self._link = CopyField(on_copy=on_copy, label=PAIR["copy"])
        self._caption = Text("", "caption", "textTertiary", center=True)
        self._caption.set_margin_top(-4)
        self._notices = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        for widget in (self._qr, self._instructions, self._link, self._caption, self._notices):
            self.append(widget)
        self.append(Notice(secret, tone="warning"))

    def set_link(self, link: str | None, caption: str = "") -> None:
        self.link = link
        for widget in (self._qr, self._instructions, self._link):
            widget.set_visible(link is not None)
        self._qr.set_text(link)
        self._link.set_text(link or "")
        self._caption.set_label(caption)
        self._caption.set_visible(bool(caption))

    def set_notices(self, notices: list[Notice]) -> None:
        while (child := self._notices.get_first_child()) is not None:
            self._notices.remove(child)
        for notice in notices:
            self._notices.append(notice)
        self._notices.set_visible(bool(notices))


def sandbox_notices(ctx: AppContext, state: ConnectionState) -> tuple[str | None, str, list[Notice]]:
    config = state.config
    if config is None:
        return None, "", [Notice(PAIR["unconfigured"], tone="warning", action_label=PAIR["set_up"], on_action=ctx.open_preferences)]
    try:
        link = config.pairing_link()
    except PairingError as error:
        return None, "", [Notice(PAIR["invalid"].format(error=error), tone="danger")]
    url = config.pairing_base_url
    caption = PAIR["sandbox"].format(name=config.name, url=url) if config.name else url
    return link, caption, [] if state.online else [Notice(PAIR["offline"], tone="warning")]


def host_notices(state: HostShellState, start: Callable[[], None], set_pin: Callable[[], None], retry: Callable[[], None]) -> list[Notice]:
    notices: list[Notice] = []
    if state.status == "failed":
        notices.append(Notice(PAIR["host_failed"].format(error=state.error or ""), tone="danger", action_label=PAIR["retry"], on_action=retry))
    elif state.status == "stopped":
        notices.append(Notice(PAIR["host_stopped"], tone="warning", action_label=PAIR["start"], on_action=start))
    elif state.status == "starting":
        notices.append(Notice(PAIR["host_starting"]))
    elif state.status == "external":
        notices.append(Notice(PAIR["host_external"]))
    if state.pairing is None and state.status != "failed":
        notices.append(Notice(PAIR["host_loading"]))
    elif state.pairing is not None and not state.pairing.pin_set:
        notices.append(Notice(PAIR["host_no_pin"], tone="warning", action_label=PAIR["set_pin"], on_action=set_pin))
    return notices


class PairDialog(DialogShell):
    """Pairs a phone with the sandbox (`sandbox pair`) or with this computer's host shell (`host pair`)."""

    def __init__(self, ctx: AppContext, target: str = SANDBOX) -> None:
        super().__init__(PAIR["title"], PAIR["tab_sandbox"], TARGET_ICONS[SANDBOX], DIALOG_WIDTH)
        self._ctx = ctx
        self._host_key: tuple | None = None
        self._labels = {SANDBOX: PAIR["tab_sandbox"], HOST: PAIR["tab_host"]}

        self._sandbox = PairPanel(PAIR["instructions"], PAIR["secret"], self._copy_text)
        self._host = PairPanel(PAIR["host_instructions"], PAIR["host_secret"], self._copy_text)
        self._panels = {SANDBOX: self._sandbox, HOST: self._host}
        self._target = target

        self._toggle = SegmentedControl(list(self._labels.items()), target, self._show, PAIR["title"])
        self._toggle.set_halign(Gtk.Align.CENTER)
        self.body.append(self._toggle)
        self.body.append(self._sandbox)
        self.body.append(self._host)

        self.add_action(PAIR["done"], self.close)
        self._copy = self.add_action(PAIR["copy"], self._copy_link, "primary")

        ctx.store.connection.bind(self, self._render_sandbox)
        ctx.host_shell.state.bind(self, self._render_host)
        ctx.host_shell.refresh()
        self._show(target)

    def _show(self, name: str | None) -> None:
        self._target = name = name or SANDBOX
        for key, panel in self._panels.items():
            panel.set_visible(key == name)
        self.header.breadcrumb.set_context(self._labels[name], TARGET_ICONS[name])
        self._sync_copy()

    def _active(self) -> PairPanel:
        return self._panels[self._target]

    def _sync_copy(self) -> None:
        self._copy.set_sensitive(self._active().link is not None)

    def _render_sandbox(self, state: ConnectionState) -> None:
        link, caption, notices = sandbox_notices(self._ctx, state)
        self._sandbox.set_link(link, caption)
        self._sandbox.set_notices(notices)
        self._sync_copy()

    def _render_host(self, state: HostShellState) -> None:
        key = (state.status, state.pairing, state.error)
        if key == self._host_key:
            return
        self._host_key = key
        pairing = state.pairing
        self._host.set_link(pairing.link if pairing else None, PAIR["host_caption"].format(name=pairing.name, url=pairing.url) if pairing else "")
        self._host.set_notices(host_notices(state, self._ctx.host_shell.start, self._set_pin, self._ctx.host_shell.refresh))
        self._sync_copy()

    def _set_pin(self) -> None:
        from .host_pin_dialog import HostPinDialog

        HostPinDialog(self._ctx, self).present(self)

    def _copy_link(self) -> None:
        if self._active().link:
            self._copy_text(self._active().link)

    def _copy_text(self, link: str) -> None:
        copy_to_clipboard(self, link)
        self.add_toast(Adw.Toast(title=PAIR["copied"]))


def show_pairing(ctx: AppContext, target: str = SANDBOX) -> None:
    PairDialog(ctx, target).present(ctx.window)
