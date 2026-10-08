from collections.abc import Callable

from gi.repository import Adw, Gtk

from ..theme.tone import TONE_COLORS, Tone
from .buttons import ActionButton
from .icon import Icon
from .text import Text
from .tone import ToneBinding

EMPTY_MAX_WIDTH = 460


class EmptyState(Gtk.Box):
    def __init__(
        self,
        title: str,
        message: str | None = None,
        icon: str | None = None,
        loading: bool = False,
        action_label: str | None = None,
        on_action: Callable[[], None] | None = None,
        secondary_label: str | None = None,
        on_secondary: Callable[[], None] | None = None,
    ) -> None:
        super().__init__(
            orientation=Gtk.Orientation.VERTICAL,
            spacing=8,
            halign=Gtk.Align.CENTER,
            valign=Gtk.Align.CENTER,
            margin_top=40,
            margin_bottom=40,
            margin_start=24,
            margin_end=24,
        )
        self.add_css_class("to-empty-state")
        self._spinner = Adw.Spinner(width_request=24, height_request=24, halign=Gtk.Align.CENTER)
        self._glyph = Icon(icon or "empty", "2xl", "textTertiary")
        self._glyph.add_css_class("to-empty-glyph")
        self._glyph.set_halign(Gtk.Align.CENTER)
        self._title = Text(title, "h4", "textSecondary", wrap=True, lines=None, center=True)
        self._message = Text(message or "", "bodySmall", "textTertiary", wrap=True, lines=None, center=True)
        self._message.set_max_width_chars(56)
        self._actions = Gtk.Box(spacing=8, halign=Gtk.Align.CENTER, css_classes=["to-empty-actions"])
        for widget in (self._spinner, self._glyph, self._title, self._message, self._actions):
            self.append(widget)
        self.set_size_request(-1, -1)
        self._action_callbacks: list[Callable[[], None]] = []
        self.set_content(title, message, icon, loading, action_label, on_action, secondary_label, on_secondary)

    def set_content(
        self,
        title: str,
        message: str | None = None,
        icon: str | None = None,
        loading: bool = False,
        action_label: str | None = None,
        on_action: Callable[[], None] | None = None,
        secondary_label: str | None = None,
        on_secondary: Callable[[], None] | None = None,
    ) -> None:
        self._title.set_label(title)
        self._message.set_text_value(message)
        self._spinner.set_visible(loading)
        self._glyph.set_visible(not loading and icon is not None)
        if icon:
            self._glyph.set_icon(icon)
        while (child := self._actions.get_first_child()) is not None:
            self._actions.remove(child)
        if action_label and on_action:
            self._actions.append(ActionButton(action_label, on_action, "primary"))
        if secondary_label and on_secondary:
            self._actions.append(ActionButton(secondary_label, on_secondary, "flat"))
        self._actions.set_visible(self._actions.get_first_child() is not None)


class Notice(Gtk.Box):
    def __init__(
        self,
        message: str,
        title: str | None = None,
        tone: Tone = "neutral",
        icon: str | None = None,
        action_label: str | None = None,
        on_action: Callable[[], None] | None = None,
    ) -> None:
        super().__init__(spacing=10, css_classes=["to-notice", "to-tone-bg"])
        self._fixed_icon = icon
        self._icon = Icon(icon or tone_icon(tone), "sm")
        self._icon.add_css_class("to-tone-fg")
        self._icon.set_valign(Gtk.Align.CENTER)
        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True, valign=Gtk.Align.CENTER)
        self._title = Text(title or "", "bodyStrong")
        self._title.set_visible(bool(title))
        self._message = Text(message, "bodySmall", "textSecondary", wrap=True, lines=None)
        body.append(self._title)
        body.append(self._message)
        self._action = Gtk.Button(css_classes=["flat", "to-tone-fg", "to-notice-action"], valign=Gtk.Align.CENTER)
        self._action.set_visible(False)
        self._action_handler: int | None = None
        self._tone = ToneBinding(tone, self, self._icon, self._title, self._action)
        self.append(self._icon)
        self.append(body)
        self.append(self._action)
        self.set_action(action_label, on_action)

    def set_action(self, label: str | None, on_action: Callable[[], None] | None) -> None:
        if self._action_handler is not None:
            self._action.disconnect(self._action_handler)
            self._action_handler = None
        visible = bool(label and on_action)
        self._action.set_visible(visible)
        if visible:
            self._action.set_label(label)
            self._action_handler = self._action.connect("clicked", lambda *_: on_action())

    def update(self, message: str, title: str | None = None, tone: Tone | None = None) -> None:
        self._message.set_label(message)
        self._title.set_text_value(title)
        if tone and tone != self._tone.tone:
            self._tone.set(tone)
            if not self._fixed_icon:
                self._icon.set_icon(tone_icon(tone))


def tone_icon(tone: Tone) -> str:
    return {"danger": "error", "warning": "warning", "success": "success"}.get(tone, "info")


def tone_foreground(tone: Tone) -> str:
    return TONE_COLORS[tone].foreground
