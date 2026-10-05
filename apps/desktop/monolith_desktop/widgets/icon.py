from gi.repository import Gtk

from ..theme.icons import resolve_icon
from .text import color_class


class Icon(Gtk.Image):
    def __init__(self, name: str, size: str = "md", color: str | None = None) -> None:
        super().__init__(icon_name=resolve_icon(name), css_classes=[f"to-icon-{size}"])
        self._color = color
        if color:
            self.add_css_class(color_class(color))

    def set_icon(self, name: str) -> None:
        self.set_from_icon_name(resolve_icon(name))

    def set_color(self, color: str | None) -> None:
        if self._color:
            self.remove_css_class(color_class(self._color))
        self._color = color
        if color:
            self.add_css_class(color_class(color))


class IconBadge(Gtk.Box):
    def __init__(self, name: str, size: str = "md", large: bool = False, css_class: str = "to-icon-badge") -> None:
        super().__init__(halign=Gtk.Align.START, valign=Gtk.Align.START)
        self.add_css_class(css_class)
        if large:
            self.add_css_class("large")
        self.icon = Icon(name, size)
        self.icon.set_hexpand(True)
        self.icon.set_vexpand(True)
        self.icon.set_halign(Gtk.Align.CENTER)
        self.icon.set_valign(Gtk.Align.CENTER)
        self.append(self.icon)

    def set_icon(self, name: str) -> None:
        self.icon.set_icon(name)
