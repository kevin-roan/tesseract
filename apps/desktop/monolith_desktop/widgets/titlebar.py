from gi.repository import Adw, Gtk

from .icon import Icon
from .text import Text
from .window_controls import WindowControls


class HeaderTitle(Gtk.Box):
    def __init__(self, title: str, subtitle: str | None = None) -> None:
        super().__init__(orientation=Gtk.Orientation.VERTICAL, valign=Gtk.Align.CENTER, css_classes=["to-header-title"])
        self._title = Text(title, "h4")
        self._subtitle = Text("", "caption", "textTertiary")
        self.append(self._title)
        self.append(self._subtitle)
        self.set_subtitle(subtitle)

    def set_title(self, title: str) -> None:
        self._title.set_label(title)

    def set_subtitle(self, subtitle: str | None) -> None:
        self._subtitle.set_text_value(subtitle)


class BrandMark(Gtk.Box):
    def __init__(self, name: str, icon: str) -> None:
        super().__init__(spacing=10, valign=Gtk.Align.CENTER, css_classes=["to-brand"])
        tile = Gtk.Box(valign=Gtk.Align.CENTER, css_classes=["to-brand-tile"])
        mark = Icon(icon, "sm")
        mark.set_hexpand(True)
        mark.set_vexpand(True)
        tile.append(mark)
        self.append(tile)
        self.append(Text(name, "h4"))


class Titlebar(Adw.Bin):
    def __init__(
        self,
        start: list[Gtk.Widget] | None = None,
        end: list[Gtk.Widget] | None = None,
        controls: bool = True,
    ) -> None:
        super().__init__()
        self.header = Adw.HeaderBar(
            show_start_title_buttons=False, show_end_title_buttons=False, css_classes=["to-titlebar"]
        )
        self.header.set_title_widget(Adw.Bin())
        self.set_child(self.header)
        self.controls = WindowControls() if controls else None
        self._divider = Gtk.Separator(orientation=Gtk.Orientation.VERTICAL)
        self._divider.add_css_class("to-titlebar-divider")
        if self.controls is not None:
            self.header.pack_end(self.controls)
            if end:
                self.header.pack_end(self._divider)
        for widget in reversed(end or []):
            self.header.pack_end(widget)
        for widget in start or []:
            self.header.pack_start(widget)

    def set_controls_visible(self, visible: bool) -> None:
        if self.controls is not None:
            self.controls.set_visible(visible)
            self._divider.set_visible(visible)
