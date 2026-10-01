from collections.abc import Callable

from gi.repository import GLib, Gtk

from ...widgets import IconButton

REVEAL_S = 3
EDGE_PX = 48


class FullscreenHost:
    def __init__(self, exit_icon: str, exit_label: str, exit_keys: tuple[int, ...], on_exit: Callable[[], None]) -> None:
        self._exit_icon = exit_icon
        self._exit_label = exit_label
        self._exit_keys = exit_keys
        self._on_exit = on_exit
        self._window: Gtk.Window | None = None
        self._overlay: Gtk.Overlay | None = None
        self._revealer: Gtk.Revealer | None = None
        self._hide_source: int | None = None

    @property
    def active(self) -> bool:
        return self._window is not None

    def enter(self, content: Gtk.Widget, parent: Gtk.Window | None) -> None:
        if self._window is not None:
            return
        window = Gtk.Window(transient_for=parent, decorated=False, css_classes=["to-display-fullscreen"])
        if parent is not None:
            window.set_application(parent.get_application())
        overlay = Gtk.Overlay(child=content)
        exit_button = IconButton(self._exit_icon, self._exit_label, self._on_exit, flat=False)
        exit_button.add_css_class("osd")
        exit_button.add_css_class("circular")
        self._revealer = Gtk.Revealer(
            child=exit_button,
            transition_type=Gtk.RevealerTransitionType.CROSSFADE,
            halign=Gtk.Align.END,
            valign=Gtk.Align.START,
            margin_top=16,
            margin_end=16,
        )
        overlay.add_overlay(self._revealer)
        window.set_child(overlay)
        motion = Gtk.EventControllerMotion(propagation_phase=Gtk.PropagationPhase.CAPTURE)
        motion.connect("motion", lambda _c, _x, y: self._reveal() if y < EDGE_PX else None)
        window.add_controller(motion)
        keys = Gtk.EventControllerKey()
        keys.connect("key-pressed", self._on_key)
        window.add_controller(keys)
        window.connect("close-request", self._on_close_request)
        self._window = window
        self._overlay = overlay
        window.fullscreen()
        window.present()
        self._reveal()

    def leave(self) -> None:
        window, self._window = self._window, None
        if window is None:
            return
        self._clear_hide()
        if self._overlay is not None:
            self._overlay.set_child(None)
        self._overlay = None
        self._revealer = None
        window.destroy()

    def _on_key(self, _controller: Gtk.EventControllerKey, keyval: int, _keycode: int, _state: object) -> bool:
        if keyval in self._exit_keys:
            self._on_exit()
            return True
        return False

    def _on_close_request(self, _window: Gtk.Window) -> bool:
        self._on_exit()
        return True

    def _reveal(self) -> None:
        if self._revealer is None:
            return
        self._revealer.set_reveal_child(True)
        self._clear_hide()
        self._hide_source = GLib.timeout_add_seconds(REVEAL_S, self._hide)

    def _hide(self) -> bool:
        self._hide_source = None
        if self._revealer is not None:
            self._revealer.set_reveal_child(False)
        return GLib.SOURCE_REMOVE

    def _clear_hide(self) -> None:
        if self._hide_source is not None:
            GLib.source_remove(self._hide_source)
            self._hide_source = None
