import math
import time
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass

import cairo
from gi.repository import GLib, Gtk, Pango, PangoCairo

from ...theme.manager import rgba, theme
from ..drawing import ThemedDrawing, rounded_rect, set_source, with_alpha
from .animation import Tween
from .scale import (
    Point,
    bezier_controls,
    crisp,
    nearest,
    nice_ceiling,
    percent_label,
    split_segments,
    time_label,
    time_step,
    time_ticks,
    value_ticks,
)

LINE_WIDTH = 1.5
GRID_WIDTH = 1.0
FILL_TOP_ALPHA = 0.12
FILL_BOTTOM_ALPHA = 0.0
CROSSHAIR_ALPHA = 0.55
DOT_RADIUS = 3.0
RING_WIDTH = 1.5
ISOLATED_RADIUS = 2.0
LABEL_SIZE = 11
TOOLTIP_TITLE_SIZE = 11
TOOLTIP_VALUE_SIZE = 12
TOOLTIP_PADDING = 10
TOOLTIP_ROW_GAP = 4
TOOLTIP_KEY_WIDTH = 14
TOOLTIP_GAP = 14
TOOLTIP_RADIUS = 8
AXIS_GAP = 8
PAD_TOP = 12
PAD_RIGHT = 14
PAD_BOTTOM = 8
MIN_TICK_SPACING = 92
LABEL_GAP = 10
THRESHOLD_DASH = (5.0, 4.0)
PLATE_PADDING = 4
PLATE_ALPHA = 0.85
REDRAW_INTERVAL_MS = 1000
DEFAULT_HEIGHT = 240


@dataclass(frozen=True)
class ChartSeries:
    key: str
    label: str
    color: int
    points: tuple[Point, ...]
    fill: bool = False
    dash: tuple[float, ...] = ()


@dataclass(frozen=True)
class Threshold:
    value: float
    label: str


@dataclass(frozen=True)
class _Plot:
    x0: float
    y0: float
    x1: float
    y1: float
    start: float
    end: float
    ceiling: float

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def height(self) -> float:
        return self.y1 - self.y0

    def x(self, t: float) -> float:
        return self.x0 + (t - self.start) / max(1e-6, self.end - self.start) * self.width

    def t(self, x: float) -> float:
        return self.start + (x - self.x0) / max(1e-6, self.width) * (self.end - self.start)

    def y(self, value: float) -> float:
        return self.y1 - value / max(1e-6, self.ceiling) * self.height


class TimeSeriesChart(ThemedDrawing):
    def __init__(
        self,
        duration_s: float,
        height: int = DEFAULT_HEIGHT,
        floor: float = 1.0,
        value_format: Callable[[float], str] = percent_label,
        empty_label: str = "",
        now_label: str = "",
        missing_label: str = "",
        clock: Callable[[], float] = time.time,
    ) -> None:
        super().__init__(self._paint)
        self.add_css_class("to-timeseries")
        self.set_content_height(height)
        self.set_hexpand(True)
        self._clock = clock
        self._floor = floor
        self._format = value_format
        self._empty_label = empty_label
        self._now_label = now_label
        self._missing_label = missing_label
        self._series: list[ChartSeries] = []
        self._hidden: set[str] = set()
        self._alpha: dict[str, Tween] = {}
        self._threshold: Threshold | None = None
        self._duration = Tween(duration_s)
        self._ceiling = Tween(floor)
        self._pointer: tuple[float, float] | None = None
        self._tick_id: int | None = None
        self._timer: int | None = None
        self._drawn_end = 0.0

        motion = Gtk.EventControllerMotion()
        motion.connect("motion", lambda _c, x, y: self._hover((x, y)))
        motion.connect("leave", lambda _c: self._hover(None))
        self.add_controller(motion)
        self.connect("map", lambda *_: self._start_timer())
        self.connect("unmap", lambda *_: self._stop_timer())

    def set_series(self, series: Iterable[ChartSeries]) -> None:
        self._series = list(series)
        now = self._now()
        for item in self._series:
            self._alpha.setdefault(item.key, Tween(0.0 if item.key in self._hidden else 1.0))
        self._retarget(now)
        self.queue_draw()

    def set_hidden(self, keys: Iterable[str]) -> None:
        self._hidden = set(keys)
        now = self._now()
        for key, tween in self._alpha.items():
            tween.set(0.0 if key in self._hidden else 1.0, now)
        self._retarget(now)
        self._animate()

    def set_duration(self, duration_s: float, animate: bool = True) -> None:
        now = self._now()
        self._duration.set(duration_s, now, animate and self.get_mapped())
        self._retarget(now)
        self._animate()

    def set_threshold(self, threshold: Threshold | None) -> None:
        self._threshold = threshold
        self.queue_draw()

    def _now(self) -> float:
        return GLib.get_monotonic_time() / 1_000_000

    def _visible(self) -> list[ChartSeries]:
        return [s for s in self._series if s.key not in self._hidden]

    def _retarget(self, now: float) -> None:
        end = self._clock()
        start = end - self._duration.target
        peak = max(
            (v for s in self._visible() for t, v in s.points if v is not None and start <= t <= end),
            default=0.0,
        )
        self._ceiling.set(nice_ceiling(peak, self._floor), now, self.get_mapped())
        self._animate()

    def _animate(self) -> None:
        if self._tick_id is None and self.get_mapped():
            self._tick_id = self.add_tick_callback(self._on_tick)
        self.queue_draw()

    def _on_tick(self, _widget, _clock) -> bool:
        self.queue_draw()
        now = self._now()
        running = self._duration.running(now) or self._ceiling.running(now) or any(
            tween.running(now) for tween in self._alpha.values()
        )
        if not running:
            self._tick_id = None
        return running

    def _start_timer(self) -> None:
        if self._timer is None:
            self._timer = GLib.timeout_add(REDRAW_INTERVAL_MS, self._on_timer)

    def _stop_timer(self) -> None:
        if self._timer is not None:
            GLib.source_remove(self._timer)
            self._timer = None
        if self._tick_id is not None:
            self.remove_tick_callback(self._tick_id)
            self._tick_id = None

    def _on_timer(self) -> bool:
        seconds_per_pixel = self._duration.target / max(1, self.get_width())
        if self._clock() - self._drawn_end >= seconds_per_pixel:
            self.queue_draw()
        return GLib.SOURCE_CONTINUE

    def _hover(self, pointer: tuple[float, float] | None) -> None:
        self._pointer = pointer
        self.queue_draw()

    def _font(self, size: int, bold: bool = False) -> Pango.FontDescription:
        font = self.get_pango_context().get_font_description().copy()
        font.set_absolute_size(size * Pango.SCALE)
        font.set_weight(Pango.Weight.SEMIBOLD if bold else Pango.Weight.NORMAL)
        return font

    def _layout(self, text: str, size: int = LABEL_SIZE, bold: bool = False) -> Pango.Layout:
        layout = self.create_pango_layout(text)
        layout.set_font_description(self._font(size, bold))
        attrs = Pango.AttrList()
        attrs.insert(Pango.attr_font_features_new("tnum 1"))
        layout.set_attributes(attrs)
        return layout

    @staticmethod
    def _size(layout: Pango.Layout) -> tuple[float, float]:
        _ink, logical = layout.get_pixel_extents()
        return logical.width, logical.height

    def _draw_layout(self, cr, layout: Pango.Layout, x: float, y: float, color) -> None:
        set_source(cr, color)
        cr.move_to(x, y)
        PangoCairo.show_layout(cr, layout)

    def _paint(self, cr, width: int, height: int) -> None:
        now = self._now()
        palette = theme().chart()
        scale = self.get_scale_factor()
        label_color = theme().color("textTertiary")
        end = self._clock()
        self._drawn_end = end
        duration = self._duration.value(now)
        ceiling = self._ceiling.value(now)
        ticks = [v for v in value_ticks(self._ceiling.target) if v <= ceiling + 1e-9]
        y_labels = [(v, self._layout(self._format(v))) for v in ticks]
        label_width = max((self._size(layout)[0] for _v, layout in y_labels), default=0)
        label_height = self._size(self._layout("0"))[1]
        plot = _Plot(
            label_width + AXIS_GAP, PAD_TOP, width - PAD_RIGHT, height - label_height - AXIS_GAP - PAD_BOTTOM,
            end - duration, end, ceiling,
        )
        if plot.width <= 0 or plot.height <= 0:
            return

        self._paint_grid(cr, plot, y_labels, label_height, scale, palette, label_color)
        self._paint_time_axis(cr, plot, label_height, scale, palette, label_color)
        self._paint_threshold(cr, plot, scale, palette, label_color)

        drawn = self._drawn_series(now)
        cr.save()
        cr.rectangle(plot.x0, 0, plot.width, plot.y1 + LINE_WIDTH)
        cr.clip()
        for series, alpha in reversed(drawn):
            self._paint_series(cr, plot, series, alpha, palette)
        cr.restore()
        self._paint_latest(cr, plot, drawn, palette)
        densest = max(
            (
                sum(1 for t, v in series.points if v is not None and plot.start <= t <= plot.end)
                for series, _a in drawn if series.key not in self._hidden
            ),
            default=0,
        )
        if densest < 2:
            self._paint_empty(cr, plot, label_color)
        elif self._pointer is not None:
            self._paint_hover(cr, plot, drawn, scale, palette, label_color, width)

    def _drawn_series(self, now: float) -> list[tuple[ChartSeries, float]]:
        drawn = []
        for series in self._series:
            tween = self._alpha.get(series.key)
            alpha = tween.value(now) if tween else 1.0
            if alpha > 0.01:
                drawn.append((series, alpha))
        return drawn

    def _series_color(self, palette, series: ChartSeries):
        return rgba(palette.categorical[series.color % len(palette.categorical)])

    def _paint_grid(self, cr, plot: _Plot, y_labels, label_height: float, scale: float, palette, label_color) -> None:
        cr.set_line_width(GRID_WIDTH)
        for value, layout in y_labels:
            y = crisp(plot.y(value), scale, GRID_WIDTH)
            baseline = value == 0 or (value == 1 and plot.ceiling > 1)
            set_source(cr, rgba(palette.axis if baseline else palette.grid))
            cr.move_to(plot.x0, y)
            cr.line_to(plot.x1, y)
            cr.stroke()
            label_width, _h = self._size(layout)
            self._draw_layout(cr, layout, plot.x0 - AXIS_GAP - label_width, plot.y(value) - label_height / 2, label_color)

    def _paint_time_axis(self, cr, plot: _Plot, label_height: float, scale: float, palette, label_color) -> None:
        max_ticks = max(1, int(plot.width // MIN_TICK_SPACING))
        step = time_step(plot.end - plot.start, max_ticks)
        label_y = plot.y1 + AXIS_GAP
        now_layout = self._layout(self._now_label) if self._now_label else None
        right_limit = plot.x1
        if now_layout is not None:
            now_width, _h = self._size(now_layout)
            self._draw_layout(cr, now_layout, plot.x1 - now_width, label_y, label_color)
            right_limit = plot.x1 - now_width - LABEL_GAP
        last_right = -math.inf
        for tick in time_ticks(plot.start, plot.end, max_ticks):
            x = plot.x(tick)
            if x < plot.x0 or x > plot.x1:
                continue
            layout = self._layout(time_label(tick, step))
            label_width, _h = self._size(layout)
            left = min(max(x - label_width / 2, plot.x0), plot.x1 - label_width)
            if left < last_right + LABEL_GAP or left + label_width > right_limit:
                continue
            self._draw_layout(cr, layout, left, label_y, label_color)
            last_right = left + label_width

    def _paint_threshold(self, cr, plot: _Plot, scale: float, palette, label_color) -> None:
        threshold = self._threshold
        if threshold is None or threshold.value > plot.ceiling:
            return
        warning = rgba(palette.status["warning"])
        y = crisp(plot.y(threshold.value), scale, GRID_WIDTH)
        cr.save()
        cr.set_line_width(GRID_WIDTH)
        cr.set_dash(THRESHOLD_DASH)
        set_source(cr, with_alpha(warning, 0.85))
        cr.move_to(plot.x0, y)
        cr.line_to(plot.x1, y)
        cr.stroke()
        cr.restore()
        layout = self._layout(threshold.label)
        label_width, label_height = self._size(layout)
        left, top = plot.x1 - label_width - PLATE_PADDING, y - label_height - PLATE_PADDING
        rounded_rect(cr, left - PLATE_PADDING, top, label_width + 2 * PLATE_PADDING, label_height, label_height / 2)
        set_source(cr, with_alpha(theme().color("surfaceElevated"), PLATE_ALPHA))
        cr.fill()
        self._draw_layout(cr, layout, left, top, label_color)

    def _segment_path(self, cr, points: Sequence[tuple[float, float]]) -> None:
        cr.move_to(*points[0])
        for (c1x, c1y), (c2x, c2y), (x, y) in bezier_controls(points):
            cr.curve_to(c1x, c1y, c2x, c2y, x, y)

    def _paint_series(self, cr, plot: _Plot, series: ChartSeries, alpha: float, palette) -> None:
        color = self._series_color(palette, series)
        margin = plot.end - plot.start
        for segment in split_segments(series.points):
            if segment[-1][0] < plot.start - margin or segment[0][0] > plot.end:
                continue
            points = [(plot.x(t), plot.y(v)) for t, v in segment]
            if len(points) == 1:
                set_source(cr, with_alpha(color, alpha))
                cr.arc(points[0][0], points[0][1], ISOLATED_RADIUS, 0, 2 * math.pi)
                cr.fill()
                continue
            if series.fill:
                self._segment_path(cr, points)
                cr.line_to(points[-1][0], plot.y1)
                cr.line_to(points[0][0], plot.y1)
                cr.close_path()
                gradient = cairo.LinearGradient(0, plot.y0, 0, plot.y1)
                gradient.add_color_stop_rgba(0, color.red, color.green, color.blue, FILL_TOP_ALPHA * alpha)
                gradient.add_color_stop_rgba(1, color.red, color.green, color.blue, FILL_BOTTOM_ALPHA)
                cr.set_source(gradient)
                cr.fill()
            self._segment_path(cr, points)
            cr.set_line_width(LINE_WIDTH)
            cr.set_line_cap(cairo.LINE_CAP_ROUND)
            cr.set_line_join(cairo.LINE_JOIN_ROUND)
            cr.set_dash(series.dash)
            set_source(cr, with_alpha(color, alpha))
            cr.stroke()
            cr.set_dash(())

    def _dot(self, cr, x: float, y: float, color, alpha: float) -> None:
        set_source(cr, with_alpha(theme().color("surface"), alpha))
        cr.arc(x, y, DOT_RADIUS + RING_WIDTH, 0, 2 * math.pi)
        cr.fill()
        set_source(cr, with_alpha(color, alpha))
        cr.arc(x, y, DOT_RADIUS, 0, 2 * math.pi)
        cr.fill()

    def _paint_latest(self, cr, plot: _Plot, drawn, palette) -> None:
        for series, alpha in drawn:
            last = next(((t, v) for t, v in reversed(series.points) if v is not None), None)
            if last is None or series.points[-1][1] is None or not plot.start <= last[0] <= plot.end:
                continue
            self._dot(cr, plot.x(last[0]), plot.y(min(last[1], plot.ceiling)), self._series_color(palette, series), alpha)

    def _paint_hover(self, cr, plot: _Plot, drawn, scale: float, palette, label_color, width: int) -> None:
        px, _py = self._pointer
        if not plot.x0 <= px <= plot.x1:
            return
        active = [(s, a) for s, a in drawn if s.key not in self._hidden]
        times = sorted({t for s, _a in active for t, v in s.points if v is not None and plot.start <= t <= plot.end})
        index = nearest(times, plot.t(px))
        if index is None:
            return
        moment = times[index]
        x = crisp(plot.x(moment), scale, GRID_WIDTH)
        cr.set_line_width(GRID_WIDTH)
        set_source(cr, with_alpha(label_color, CROSSHAIR_ALPHA))
        cr.move_to(x, plot.y0)
        cr.line_to(x, plot.y1)
        cr.stroke()
        rows = []
        for series, alpha in active:
            value = next((v for t, v in series.points if t == moment and v is not None), None)
            color = self._series_color(palette, series)
            if value is not None:
                self._dot(cr, plot.x(moment), plot.y(min(value, plot.ceiling)), color, alpha)
            rows.append((series, color, self._format(value) if value is not None else self._missing_label))
        self._paint_tooltip(cr, plot, plot.x(moment), time_label(moment, 1), rows, label_color, width)

    def _paint_tooltip(self, cr, plot: _Plot, x: float, title: str, rows, label_color, width: int) -> None:
        title_layout = self._layout(title, TOOLTIP_TITLE_SIZE)
        row_layouts = [
            (series, color, self._layout(value, TOOLTIP_VALUE_SIZE, True), self._layout(series.label, TOOLTIP_TITLE_SIZE))
            for series, color, value in rows
        ]
        title_w, title_h = self._size(title_layout)
        value_w = max((self._size(v)[0] for _s, _c, v, _l in row_layouts), default=0)
        label_w = max((self._size(label)[0] for _s, _c, _v, label in row_layouts), default=0)
        row_h = max((self._size(v)[1] for _s, _c, v, _l in row_layouts), default=title_h)
        box_w = TOOLTIP_PADDING * 2 + max(title_w, TOOLTIP_KEY_WIDTH + 8 + value_w + 8 + label_w)
        box_h = TOOLTIP_PADDING * 2 + title_h + len(row_layouts) * (row_h + TOOLTIP_ROW_GAP)
        left = x + TOOLTIP_GAP
        if left + box_w > width - 2:
            left = x - TOOLTIP_GAP - box_w
        left = max(2, left)
        top = plot.y0 + 4
        rounded_rect(cr, left, top, box_w, box_h, TOOLTIP_RADIUS)
        set_source(cr, theme().color("surfaceElevated"))
        cr.fill_preserve()
        set_source(cr, theme().color("border"))
        cr.set_line_width(1)
        cr.stroke()
        self._draw_layout(cr, title_layout, left + TOOLTIP_PADDING, top + TOOLTIP_PADDING, label_color)
        y = top + TOOLTIP_PADDING + title_h + TOOLTIP_ROW_GAP
        text = theme().color("text")
        for series, color, value_layout, label_layout in row_layouts:
            key_y = y + row_h / 2
            cr.set_line_width(LINE_WIDTH + 1)
            cr.set_line_cap(cairo.LINE_CAP_ROUND)
            cr.set_dash(series.dash)
            set_source(cr, color)
            cr.move_to(left + TOOLTIP_PADDING + 1, key_y)
            cr.line_to(left + TOOLTIP_PADDING + TOOLTIP_KEY_WIDTH - 1, key_y)
            cr.stroke()
            cr.set_dash(())
            value_x = left + TOOLTIP_PADDING + TOOLTIP_KEY_WIDTH + 8
            self._draw_layout(cr, value_layout, value_x, y, text)
            label_height = self._size(label_layout)[1]
            self._draw_layout(cr, label_layout, value_x + value_w + 8, y + (row_h - label_height) / 2, label_color)
            y += row_h + TOOLTIP_ROW_GAP

    def _paint_empty(self, cr, plot: _Plot, label_color) -> None:
        if not self._empty_label:
            return
        layout = self._layout(self._empty_label, TOOLTIP_VALUE_SIZE)
        label_width, label_height = self._size(layout)
        self._draw_layout(
            cr, layout, plot.x0 + (plot.width - label_width) / 2, plot.y0 + (plot.height - label_height) / 2, label_color
        )
