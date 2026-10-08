import math
from collections.abc import Callable

from gi.repository import Gdk, Gtk

from ..theme.manager import theme


def with_alpha(color: Gdk.RGBA, alpha: float) -> Gdk.RGBA:
    copy = color.copy()
    copy.alpha = color.alpha * alpha
    return copy


def set_source(cr, color: Gdk.RGBA) -> None:
    cr.set_source_rgba(color.red, color.green, color.blue, color.alpha)


def rounded_rect(cr, x: float, y: float, width: float, height: float, radius: float) -> None:
    radius = max(0.0, min(radius, width / 2, height / 2))
    cr.new_sub_path()
    cr.arc(x + width - radius, y + radius, radius, -math.pi / 2, 0)
    cr.arc(x + width - radius, y + height - radius, radius, 0, math.pi / 2)
    cr.arc(x + radius, y + height - radius, radius, math.pi / 2, math.pi)
    cr.arc(x + radius, y + radius, radius, math.pi, 3 * math.pi / 2)
    cr.close_path()


class ThemedDrawing(Gtk.DrawingArea):
    def __init__(self, draw: Callable[[object, int, int], None]) -> None:
        super().__init__()
        self._draw_fn = draw
        self.set_draw_func(lambda _area, cr, width, height: self._draw_fn(cr, width, height))
        unsubscribe = theme().subscribe(lambda _scheme: self.queue_draw())
        self.connect("destroy", lambda *_: unsubscribe())
