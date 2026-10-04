import math

from gi.repository import Gtk

from ..theme.tone import Tone
from ..util.format import clamp_fraction
from .drawing import ThemedDrawing, rounded_rect, set_source, with_alpha
from .text import Text, color_class

TRACK_ALPHA = 0.2
BAR_HEIGHT = 4
RING_SIZE = 40
RING_THICKNESS = 3


class ProgressBar(ThemedDrawing):
    def __init__(self, progress: float | None = None, tone: Tone = "info", label: str | None = None) -> None:
        super().__init__(self._paint)
        self._progress = progress
        self._tone = tone
        self.add_css_class("to-progress-bar")
        self.add_css_class("to-tone-fg")
        self.add_css_class(f"tone-{tone}")
        self.set_content_height(BAR_HEIGHT)
        self._sync_indeterminate()
        self.set_hexpand(True)
        self.set_valign(Gtk.Align.CENTER)
        self.update_property([Gtk.AccessibleProperty.LABEL], [label or ""])

    def set_progress(self, progress: float | None) -> None:
        self._progress = progress
        self._sync_indeterminate()
        self.queue_draw()

    def _sync_indeterminate(self) -> None:
        if self._progress is None:
            self.add_css_class("indeterminate")
        else:
            self.remove_css_class("indeterminate")

    def set_tone(self, tone: Tone) -> None:
        self.remove_css_class(f"tone-{self._tone}")
        self._tone = tone
        self.add_css_class(f"tone-{tone}")
        self.queue_draw()

    def _paint(self, cr, width: int, height: int) -> None:
        color = self.get_color()
        set_source(cr, with_alpha(color, TRACK_ALPHA))
        rounded_rect(cr, 0, 0, width, height, height / 2)
        cr.fill()
        if self._progress is None:
            return
        fill = width * clamp_fraction(self._progress)
        if fill <= 0:
            return
        set_source(cr, color)
        rounded_rect(cr, 0, 0, max(fill, height), height, height / 2)
        cr.fill()


class ProgressRing(Gtk.Overlay):
    def __init__(
        self,
        progress: float = 0.0,
        size: int = RING_SIZE,
        thickness: int = RING_THICKNESS,
        color: str = "accentStrong",
        show_label: bool = True,
        label_color: str = "textSecondary",
    ) -> None:
        super().__init__(halign=Gtk.Align.END, valign=Gtk.Align.START)
        self._progress = clamp_fraction(progress)
        self._thickness = thickness
        self._color = color
        self._area = ThemedDrawing(self._paint)
        self._area.set_content_width(size)
        self._area.set_content_height(size)
        self._area.add_css_class(color_class(color))
        self.set_child(self._area)
        self._label = Text(self._label_text(), "caption", label_color, center=True)
        self._label.set_halign(Gtk.Align.CENTER)
        self._label.set_valign(Gtk.Align.CENTER)
        self._label.set_visible(show_label)
        self.add_overlay(self._label)

    def _label_text(self) -> str:
        return f"{round(self._progress * 100)}%"

    def set_progress(self, progress: float | None) -> None:
        self._progress = clamp_fraction(progress)
        self._label.set_label(self._label_text())
        self._area.queue_draw()

    def set_color(self, color: str) -> None:
        self._area.remove_css_class(color_class(self._color))
        self._color = color
        self._area.add_css_class(color_class(color))
        self._area.queue_draw()

    def _paint(self, cr, width: int, height: int) -> None:
        color = self._area.get_color()
        radius = (min(width, height) - self._thickness) / 2
        cx, cy = width / 2, height / 2
        cr.set_line_width(self._thickness)
        set_source(cr, with_alpha(color, TRACK_ALPHA))
        cr.arc(cx, cy, radius, 0, 2 * math.pi)
        cr.stroke()
        if self._progress <= 0:
            return
        set_source(cr, color)
        cr.set_line_cap(1)
        start = -math.pi / 2
        cr.arc(cx, cy, radius, start, start + 2 * math.pi * self._progress)
        cr.stroke()
