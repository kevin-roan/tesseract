from collections.abc import Callable

from gi.repository import Adw, Gtk

from ..context import AppContext
from ..hostshell import HostShellState
from ..pairing import PairingError
from ..store import ConnectionState
from ..strings import PAIR
from .buttons import ActionButton
from .code_block import copy_to_clipboard
from .feedback import Notice
from .qr import QrCode
from .text import Text

DIALOG_WIDTH = 440
SANDBOX = "sandbox"
HOST = "host"


class PairPanel(Gtk.Box):
    """QR code, deep link and caption for one pairing target, with notices above the secret warning."""

    def __init__(self, instructions: str, secret: str) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=16, css_classes=["to-pair-body"])
        self.link: str | None = None
        self._qr = QrCode()
        self._instructions = Text(instructions, "body", "textSecondary", wrap=True, lines=None, center=True)
        self._link = Text("", "caption", "text", wrap=True, lines=None, selectable=True)
        self._link.add_css_class("monospace")
        self._link.add_css_class("to-pair-link")
        self._caption = Text("", "caption", "textTertiary", wrap=True, lines=None, center=True)
        self._notices = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        for widget in (self._qr, self._instructions, self._link, self._caption, self._notices):
            self.append(widget)
        self.append(Notice(secret, tone="warning", icon="info"))

    def set_link(self, link: str | None, caption: str = "") -> None:
        self.link = link
        for widget in (self._qr, self._instructions, self._link):
            widget.set_visible(link is not None)
        self._qr.set_text(link)
        self._link.set_label(link or "")
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


class PairDialog(Adw.Dialog):
    """Pairs a phone with the sandbox (`sandbox pair`) or with this computer's host shell (`host pair`)."""

    def __init__(self, ctx: AppContext, target: str = SANDBOX) -> None:
        super().__init__(content_width=DIALOG_WIDTH, title=PAIR["title"])
        self._ctx = ctx
        self._host_key: tuple | None = None

        self._sandbox = PairPanel(PAIR["instructions"], PAIR["secret"])
        self._host = PairPanel(PAIR["host_instructions"], PAIR["host_secret"])
        self._stack = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE, vhomogeneous=False)
        self._stack.add_named(self._sandbox, SANDBOX)
        self._stack.add_named(self._host, HOST)

        self._toggle = Adw.ToggleGroup(halign=Gtk.Align.CENTER, css_classes=["round"])
        self._toggle.add(Adw.Toggle(name=SANDBOX, label=PAIR["tab_sandbox"]))
        self._toggle.add(Adw.Toggle(name=HOST, label=PAIR["tab_host"]))
        self._toggle.connect("notify::active-name", lambda *_: self._show(self._toggle.get_active_name()))

        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        content.append(self._toggle)
        content.append(self._stack)

        actions = Gtk.Box(spacing=8, halign=Gtk.Align.END, css_classes=["to-form-actions"])
        actions.append(ActionButton(PAIR["done"], self.close, "flat"))
        self._copy = ActionButton(PAIR["copy"], self._copy_link, "primary", icon="copy")
        actions.append(self._copy)
        self.set_default_widget(self._copy)

        view = Adw.ToolbarView(content=Gtk.ScrolledWindow(child=content, hscrollbar_policy=Gtk.PolicyType.NEVER, propagate_natural_height=True))
        view.add_top_bar(Adw.HeaderBar())
        view.add_bottom_bar(actions)
        self.set_child(view)

        ctx.store.connection.bind(self, self._render_sandbox)
        ctx.host_shell.state.bind(self, self._render_host)
        ctx.host_shell.refresh()
        self._toggle.set_active_name(target)
        self._show(target)

    def _show(self, name: str | None) -> None:
        self._stack.set_visible_child_name(name or SANDBOX)
        self._sync_copy()

    def _active(self) -> PairPanel:
        return self._host if self._stack.get_visible_child_name() == HOST else self._sandbox

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

        HostPinDialog(self._ctx).present(self)

    def _copy_link(self) -> None:
        link = self._active().link
        if link:
            copy_to_clipboard(self, link)
            self._ctx.toast(PAIR["copied"])


def show_pairing(ctx: AppContext, target: str = SANDBOX) -> None:
    PairDialog(ctx, target).present(ctx.window)
