from collections import deque
from collections.abc import Iterable

from gi.repository import Gtk

from .drawing import ThemedDrawing, set_source, with_alpha
from .text import color_class

FILL_ALPHA = 0.16
LINE_WIDTH = 1.75
DEFAULT_HEIGHT = 36
DEFAULT_POINTS = 60


class Sparkline(ThemedDrawing):
    def __init__(
        self,
        values: Iterable[float] = (),
        color: str = "accentStrong",
        max_points: int = DEFAULT_POINTS,
        min_value: float | None = 0.0,
        max_value: float | None = None,
        fill: bool = True,
        height: int = DEFAULT_HEIGHT,
    ) -> None:
        super().__init__(self._paint)
        self._values: deque[float] = deque(values, maxlen=max_points)
        self._min = min_value
        self._max = max_value
        self._fill = fill
        self._color_class = self._class_for(color)
        self.add_css_class(self._color_class)
        self.add_css_class("to-sparkline")
        self.set_content_height(height)
        self.set_hexpand(True)
        self.set_valign(Gtk.Align.END)

    @staticmethod
    def _class_for(color: str) -> str:
        return f"to-chart-{color}" if color.isdigit() else color_class(color)

    def set_color(self, color: str) -> None:
        self.remove_css_class(self._color_class)
        self._color_class = self._class_for(color)
        self.add_css_class(self._color_class)
        self.queue_draw()

    def push(self, value: float) -> None:
        self._values.append(value)
        self.queue_draw()

    def set_values(self, values: Iterable[float]) -> None:
        self._values.clear()
        self._values.extend(values)
        self.queue_draw()

    def set_range(self, min_value: float | None, max_value: float | None) -> None:
        self._min, self._max = min_value, max_value
        self.queue_draw()

    def _paint(self, cr, width: int, height: int) -> None:
        values = list(self._values)
        if len(values) < 2:
            return
        low = self._min if self._min is not None else min(values)
        high = self._max if self._max is not None else max(values)
        span = (high - low) or 1.0
        step = width / (self._values.maxlen - 1 if self._values.maxlen else len(values) - 1)
        offset = width - step * (len(values) - 1)
        inset = LINE_WIDTH
        points = [
            (offset + i * step, inset + (height - 2 * inset) * (1 - (min(max(v, low), high) - low) / span))
            for i, v in enumerate(values)
        ]
        color = self.get_color()
        cr.set_line_width(LINE_WIDTH)
        cr.set_line_join(1)
        cr.move_to(*points[0])
        for point in points[1:]:
            cr.line_to(*point)
        if self._fill:
            path = cr.copy_path()
            cr.line_to(points[-1][0], height)
            cr.line_to(points[0][0], height)
            cr.close_path()
            set_source(cr, with_alpha(color, FILL_ALPHA))
            cr.fill()
            cr.append_path(path)
        set_source(cr, color)
        cr.stroke()
