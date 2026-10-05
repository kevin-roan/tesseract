from collections.abc import Callable

from gi.repository import Adw, Gdk, Gtk

from .icon import Icon
from .text import Text, variant_class

SUBMIT_KEYS = (Gdk.KEY_Return, Gdk.KEY_KP_Enter, Gdk.KEY_ISO_Enter)


class SendButton(Gtk.Button):
    """The round arrow that sends a reply, or with `pill` the labelled primary button of a new prompt."""

    def __init__(self, label: str, on_activate: Callable[[], None], pill: bool = False) -> None:
        super().__init__(css_classes=["to-composer-send"], valign=Gtk.Align.END, tooltip_text=label)
        self.update_property([Gtk.AccessibleProperty.LABEL], [label])
        self._stack = Gtk.Stack(hhomogeneous=False, interpolate_size=False)
        if pill:
            self.add_css_class("pill")
            text = Text(label, "label")
            text.remove_css_class("to-fg-text")
            self._stack.add_named(text, "idle")
        else:
            self._stack.add_named(Icon("send", "sm"), "idle")
        self._stack.add_named(Adw.Spinner(width_request=14, height_request=14), "busy")
        self.set_child(self._stack)
        self.connect("clicked", lambda *_: on_activate())

    def set_busy(self, busy: bool) -> None:
        self._stack.set_visible_child_name("busy" if busy else "idle")


class Composer(Gtk.Box):
    def __init__(
        self,
        placeholder: str,
        send_label: str,
        on_submit: Callable[[str], None],
        hint: str | None = None,
        min_height: int = 24,
        max_height: int = 240,
        large: bool = False,
    ) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=8, css_classes=["to-composer"])
        if large:
            self.add_css_class("large")
        self._on_submit = on_submit
        self._hint_text = hint or ""
        self._busy = False
        self._locked = False
        self._has_attachments = False
        self._attachments_blocked = False

        self._buffer = Gtk.TextBuffer()
        self._buffer.connect("changed", lambda *_: self._sync())
        self._view = Gtk.TextView(
            buffer=self._buffer,
            wrap_mode=Gtk.WrapMode.WORD_CHAR,
            accepts_tab=False,
            css_classes=["to-composer-input", variant_class("bodyLarge" if large else "body")],
            hexpand=True,
        )
        self._view.update_property([Gtk.AccessibleProperty.LABEL], [placeholder])
        keys = Gtk.EventControllerKey(propagation_phase=Gtk.PropagationPhase.CAPTURE)
        keys.connect("key-pressed", self._key_pressed)
        self._view.add_controller(keys)
        scroller = Gtk.ScrolledWindow(
            child=self._view,
            hscrollbar_policy=Gtk.PolicyType.NEVER,
            propagate_natural_height=True,
            min_content_height=min_height,
            max_content_height=max_height,
        )
        self._placeholder = Text(placeholder, "h3" if large else "body", "textTertiary")
        self._placeholder.set_halign(Gtk.Align.START)
        self._placeholder.set_valign(Gtk.Align.START)
        self._placeholder.set_can_target(False)
        self._placeholder.add_css_class("to-composer-placeholder")
        overlay = Gtk.Overlay(child=scroller)
        overlay.add_overlay(self._placeholder)
        self.append(overlay)

        self._properties = Gtk.Box(spacing=6, css_classes=["to-composer-properties"])
        self._properties.set_visible(False)
        self.append(self._properties)

        bar = Gtk.Box(spacing=8, css_classes=["to-composer-bar"])
        self._accessories = Gtk.Box(spacing=4, valign=Gtk.Align.CENTER)
        bar.append(self._accessories)
        self._hint = Text(self._hint_text, "caption", "textTertiary", wrap=True, lines=2, xalign=1.0)
        self._hint.set_justify(Gtk.Justification.RIGHT)
        self._hint.set_hexpand(True)
        self._hint.set_valign(Gtk.Align.CENTER)
        bar.append(self._hint)
        self._send = SendButton(send_label, self.submit, pill=large)
        bar.append(self._send)
        self.append(bar)

        click = Gtk.GestureClick()
        click.connect("released", lambda *_: self.focus_input())
        overlay.add_controller(click)
        self._sync()

    @property
    def text(self) -> str:
        return self._buffer.get_text(self._buffer.get_start_iter(), self._buffer.get_end_iter(), False)

    def set_text(self, text: str) -> None:
        self._buffer.set_text(text)
        self._buffer.place_cursor(self._buffer.get_end_iter())

    @property
    def input(self) -> Gtk.TextView:
        return self._view

    def clear(self) -> None:
        self._buffer.set_text("")

    def focus_input(self) -> None:
        if not self._locked:
            self._view.grab_focus()

    def add_property(self, widget: Gtk.Widget) -> None:
        self._properties.append(widget)
        self._properties.set_visible(True)

    def add_accessory(self, widget: Gtk.Widget) -> None:
        self._accessories.append(widget)

    def prepend_accessory(self, widget: Gtk.Widget) -> None:
        self._accessories.prepend(widget)

    def set_tray(self, widget: Gtk.Widget) -> None:
        self.prepend(widget)

    def set_attachments(self, has_items: bool, blocked: bool) -> None:
        """With attachments the prompt may be empty; while they upload or after one fails, sending waits."""
        self._has_attachments = has_items
        self._attachments_blocked = blocked
        self._sync()

    def set_placeholder(self, text: str) -> None:
        self._placeholder.set_label(text)

    def set_busy(self, busy: bool) -> None:
        self._busy = busy
        self._send.set_busy(busy)
        self._sync()

    def set_locked(self, reason: str | None) -> None:
        self._locked = reason is not None
        self._view.set_editable(not self._locked)
        self._view.set_cursor_visible(not self._locked)
        self._hint.set_label(reason or self._hint_text)
        self._hint.set_color("warning" if reason else "textTertiary")
        if self._locked:
            self.add_css_class("locked")
        else:
            self.remove_css_class("locked")
        self._sync()

    def submit(self) -> None:
        if self._can_submit():
            self._on_submit(self.text.strip())

    def _can_submit(self) -> bool:
        has_draft = bool(self.text.strip()) or self._has_attachments
        return has_draft and not self._busy and not self._locked and not self._attachments_blocked

    def _sync(self) -> None:
        empty = not self.text
        self._placeholder.set_visible(empty)
        self._send.set_sensitive(self._can_submit())

    def _key_pressed(self, _controller, keyval: int, _keycode: int, state: Gdk.ModifierType) -> bool:
        if keyval not in SUBMIT_KEYS:
            return False
        if state & Gdk.ModifierType.SHIFT_MASK:
            return False
        self.submit()
        return True
