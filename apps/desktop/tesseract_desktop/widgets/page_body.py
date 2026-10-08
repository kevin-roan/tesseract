from gi.repository import Adw, Gtk

from ..theme.tokens import SECTION_GAP


class PageBody(Gtk.ScrolledWindow):
    def __init__(self, max_width: int | None = None, spacing: int = SECTION_GAP) -> None:
        super().__init__(hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True, hexpand=True)
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=spacing, css_classes=["to-page"])
        if max_width is None:
            self.set_child(self.box)
        else:
            self.set_child(Adw.Clamp(maximum_size=max_width, tightening_threshold=max_width, child=self.box))

    def append(self, widget: Gtk.Widget) -> Gtk.Widget:
        self.box.append(widget)
        return widget

    def remove(self, widget: Gtk.Widget) -> None:
        self.box.remove(widget)
