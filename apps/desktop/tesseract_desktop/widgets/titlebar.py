from gi.repository import Adw, Gtk

from ..theme.icons import resolve_icon
from .text import Text
from .window_controls import WindowControls


def caret(name: str = "caret-down") -> Gtk.Image:
    return Gtk.Image(icon_name=resolve_icon(name), valign=Gtk.Align.CENTER, css_classes=["to-caret"])


class HeaderTitle(Gtk.Box):
    """A Linear-style breadcrumb: the optional parent in secondary text, a chevron, then the page title."""

    def __init__(self, title: str, subtitle: str | None = None) -> None:
        super().__init__(spacing=6, valign=Gtk.Align.CENTER, css_classes=["to-header-title"])
        self._parent = Text("", "label", "textSecondary")
        self._separator = caret("caret-right")
        self._separator.add_css_class("to-crumb-separator")
        self._title = Text(title, "label")
        for widget in (self._parent, self._separator, self._title):
            self.append(widget)
        self.set_subtitle(subtitle)

    def set_title(self, title: str) -> None:
        self._title.set_label(title)

    def set_subtitle(self, subtitle: str | None) -> None:
        self._parent.set_text_value(subtitle)
        self._separator.set_visible(bool(subtitle))


class BrandMark(Gtk.Box):
    """The workspace switcher face: the app logo in a small rounded square, the name and a caret."""

    def __init__(self, name: str, icon_name: str) -> None:
        super().__init__(spacing=8, valign=Gtk.Align.CENTER, css_classes=["to-brand"])
        logo = Gtk.Image(icon_name=icon_name, valign=Gtk.Align.CENTER, css_classes=["to-brand-logo"])
        self.append(logo)
        self.append(Text(name, "bodyStrong"))
        self.append(caret())


class Titlebar(Adw.Bin):
    def __init__(
        self,
        start: list[Gtk.Widget] | None = None,
        end: list[Gtk.Widget] | None = None,
        controls: bool = True,
        css_class: str = "to-page-header",
    ) -> None:
        super().__init__()
        self.header = Adw.HeaderBar(
            show_start_title_buttons=False, show_end_title_buttons=False, css_classes=["to-titlebar", css_class]
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
