import math
from dataclasses import dataclass

from gi.repository import Gtk

from ..theme.manager import theme
from ..theme.tokens import DURATIONS
from .drawing import ThemedDrawing, set_source, with_alpha

GOLDEN_ANGLE = math.pi * (3 - math.sqrt(5))
TURN = math.pi * 2
DEPTH_BANDS = 5
FRAMES_PER_TURN = 90


@dataclass(frozen=True)
class SpherePoint:
    x: float
    y: float
    z: float


@dataclass(frozen=True)
class SphereDot:
    x: float
    y: float
    radius: float
    band: int


def sphere_points(count: int) -> list[SpherePoint]:
    points = []
    for index in range(count):
        y = 1 - ((index + 0.5) / count) * 2
        ring = math.sqrt(1 - y * y)
        angle = index * GOLDEN_ANGLE
        points.append(SpherePoint(math.cos(angle) * ring, y, math.sin(angle) * ring))
    return points


def band_opacity(band: int) -> float:
    return 0.12 + ((band + 0.5) / DEPTH_BANDS) * 0.88


def sphere_dots(points: list[SpherePoint], angle: float, center: float, radius: float, dot_radius: float) -> list[SphereDot]:
    """The sphere turned by `angle`; dots nearer the viewer are larger and land in a brighter band."""
    cos, sin = math.cos(angle), math.sin(angle)
    dots = []
    for point in points:
        depth = (point.z * cos - point.x * sin + 1) / 2
        dots.append(SphereDot(
            x=center + (point.x * cos + point.z * sin) * radius,
            y=center - point.y * radius,
            radius=dot_radius * (0.45 + depth * 0.55),
            band=min(DEPTH_BANDS - 1, int(depth * DEPTH_BANDS)),
        ))
    return dots


def frame_angle(seconds: float, period_ms: int) -> float:
    frame = math.floor((seconds * 1000 / period_ms) * FRAMES_PER_TURN) % FRAMES_PER_TURN
    return frame / FRAMES_PER_TURN * TURN


class DotSphere(ThemedDrawing):
    """The slowly turning globe of dots that marks work in progress, as on mobile; it holds still when idle."""

    def __init__(self, size: int, dots: int = 24, color: str = "text", period: int = DURATIONS["slowest"] * 10) -> None:
        super().__init__(self._paint)
        self.set_size_request(size, size)
        self.set_halign(Gtk.Align.CENTER)
        self.set_valign(Gtk.Align.CENTER)
        self._points = sphere_points(dots)
        self._color = color
        self._period = period
        self._angle = 0.0
        self._tick_id: int | None = None
        self._spinning = False
        self.connect("map", lambda *_: self.set_spinning(self._spinning))
        self.connect("unmap", lambda *_: self._stop())

    def set_spinning(self, spinning: bool) -> None:
        self._spinning = spinning
        animate = spinning and self.get_mapped() and self.get_settings().get_property("gtk-enable-animations")
        if animate and self._tick_id is None:
            self._tick_id = self.add_tick_callback(self._on_tick)
        elif not animate:
            self._stop()

    def _stop(self) -> None:
        if self._tick_id is not None:
            self.remove_tick_callback(self._tick_id)
            self._tick_id = None

    def _on_tick(self, _widget, clock) -> bool:
        angle = frame_angle(clock.get_frame_time() / 1_000_000, self._period)
        if angle != self._angle:
            self._angle = angle
            self.queue_draw()
        return True

    def _paint(self, cr, width: int, height: int) -> None:
        size = min(width, height)
        dot_radius = max(1.0, size / 20)
        center = size / 2
        cr.translate((width - size) / 2, (height - size) / 2)
        color = theme().color(self._color)
        dots = sphere_dots(self._points, self._angle, center, center - dot_radius, dot_radius)
        for band in range(DEPTH_BANDS):
            set_source(cr, with_alpha(color, band_opacity(band)))
            for dot in dots:
                if dot.band == band:
                    cr.new_sub_path()
                    cr.arc(dot.x, dot.y, dot.radius, 0, TURN)
            cr.fill()
