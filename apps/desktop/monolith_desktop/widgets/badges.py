from gi.repository import Gtk

from ..theme.tone import Tone
from .icon import Icon
from .text import Text
from .tone import ToneBinding


class StatusBadge(Gtk.Box):
    def __init__(self, label: str, tone: Tone = "neutral", icon: str | None = None) -> None:
        super().__init__(spacing=4, valign=Gtk.Align.CENTER, halign=Gtk.Align.START)
        self.add_css_class("to-status-badge")
        self.add_css_class("to-tone-bg")
        self._dot = Gtk.Box(valign=Gtk.Align.CENTER, css_classes=["to-tone-dot"])
        self._icon = Icon(icon or "info", "xs")
        self._icon.add_css_class("to-tone-fg")
        self._icon.set_visible(icon is not None)
        self._dot.set_visible(icon is None)
        self._label = Text(label, "caption")
        self._label.add_css_class("to-tone-fg")
        self._tone = ToneBinding(tone, self, self._dot, self._icon, self._label)
        self.append(self._dot)
        self.append(self._icon)
        self.append(self._label)

    @property
    def tone(self) -> Tone:
        return self._tone.tone

    def set_label(self, label: str) -> None:
        self._label.set_label(label)

    def set_tone(self, tone: Tone) -> None:
        self._tone.set(tone)

    def set_icon(self, icon: str | None) -> None:
        if icon:
            self._icon.set_icon(icon)
        self._icon.set_visible(icon is not None)
        self._dot.set_visible(icon is None)

    def set_live(self, live: bool) -> None:
        if live:
            self.add_css_class("live")
        else:
            self.remove_css_class("live")

    def update(self, label: str, tone: Tone, live: bool = False) -> None:
        self.set_label(label)
        self.set_tone(tone)
        self.set_live(live)


class ConnectionDot(Gtk.Box):
    def __init__(self, tone: Tone = "neutral", label: str | None = None) -> None:
        super().__init__(spacing=6, valign=Gtk.Align.CENTER, halign=Gtk.Align.START)
        halo = Gtk.Box(valign=Gtk.Align.CENTER, halign=Gtk.Align.CENTER, css_classes=["to-connection-halo", "to-tone-bg"])
        dot = Gtk.Box(valign=Gtk.Align.CENTER, halign=Gtk.Align.CENTER, css_classes=["to-tone-dot"])
        halo.append(dot)
        self._tone = ToneBinding(tone, halo, dot)
        self._label = Text(label or "", "caption", "textSecondary")
        self._label.set_visible(bool(label))
        self.append(halo)
        self.append(self._label)

    @property
    def tone(self) -> Tone:
        return self._tone.tone

    def set_tone(self, tone: Tone) -> None:
        self._tone.set(tone)

    def set_label(self, label: str | None) -> None:
        self._label.set_text_value(label)

    def update(self, tone: Tone, label: str | None) -> None:
        self.set_tone(tone)
        self.set_label(label)


class CountBadge(Gtk.Label):
    def __init__(self, count: int | None = None, maximum: int = 99) -> None:
        super().__init__(valign=Gtk.Align.CENTER, css_classes=["to-sidebar-badge"])
        self._maximum = maximum
        self.set_count(count)

    def set_count(self, count: int | None) -> None:
        self.set_visible(bool(count))
        if count:
            self.set_label(f"{self._maximum}+" if count > self._maximum else str(count))
