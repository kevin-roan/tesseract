from gi.repository import Gtk

from ..theme.tone import Tone


def tone_class(tone: str) -> str:
    return f"tone-{tone}"


class ToneBinding:
    def __init__(self, tone: Tone, *widgets: Gtk.Widget) -> None:
        self.tone = tone
        self._widgets: list[Gtk.Widget] = []
        for widget in widgets:
            self.add(widget)

    def add(self, widget: Gtk.Widget) -> Gtk.Widget:
        widget.add_css_class(tone_class(self.tone))
        self._widgets.append(widget)
        return widget

    def set(self, tone: Tone) -> None:
        for widget in self._widgets:
            widget.remove_css_class(tone_class(self.tone))
            widget.add_css_class(tone_class(tone))
        self.tone = tone
