from gi.repository import Gtk

from ..theme.surfaces import SurfaceTone


class Surface(Gtk.Box):
    def __init__(
        self,
        tone: SurfaceTone = "neutral",
        orientation: Gtk.Orientation = Gtk.Orientation.VERTICAL,
        spacing: int = 0,
        card: bool = True,
        compact: bool = False,
    ) -> None:
        super().__init__(orientation=orientation, spacing=spacing)
        self._tone = tone
        self.add_css_class("to-surface")
        self.add_css_class(f"surface-{tone}")
        if card:
            self.add_css_class("to-card")
        if compact:
            self.add_css_class("compact")
        self.set_overflow(Gtk.Overflow.HIDDEN)

    @property
    def tone(self) -> SurfaceTone:
        return self._tone

    def set_tone(self, tone: SurfaceTone) -> None:
        self.remove_css_class(f"surface-{self._tone}")
        self._tone = tone
        self.add_css_class(f"surface-{tone}")


class Pressable(Gtk.Button):
    def __init__(self, child: Gtk.Widget, on_activate, label: str | None = None) -> None:
        super().__init__(child=child)
        self.add_css_class("flat")
        self.add_css_class("to-pressable")
        if label:
            self.set_tooltip_text(label)
        self.connect("clicked", lambda *_: on_activate())
