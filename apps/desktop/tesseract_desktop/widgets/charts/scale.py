import bisect
import math
import time
from collections.abc import Sequence

Point = tuple[float, float | None]
XY = tuple[float, float]

CEILING_STEPS = (1.0, 1.25, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0)
TICK_MULTIPLIERS = (1.0, 2.0, 2.5, 5.0)
TIME_STEPS_S = (5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200)
HEADROOM = 1.04
EPSILON = 1e-9


def nice_ceiling(peak: float, floor: float = 1.0) -> float:
    if not math.isfinite(peak) or peak * HEADROOM <= floor:
        return floor
    target = peak * HEADROOM
    magnitude = 10 ** math.floor(math.log10(target))
    for step in CEILING_STEPS:
        if step * magnitude >= target - EPSILON:
            return max(floor, step * magnitude)
    return max(floor, 10 * magnitude)


def value_ticks(ceiling: float, target: int = 4) -> list[float]:
    if ceiling <= 0 or not math.isfinite(ceiling):
        return [0.0]
    best: tuple[float, float] | None = None
    exponent = math.floor(math.log10(ceiling))
    for power in range(exponent - 2, exponent + 1):
        for multiplier in TICK_MULTIPLIERS:
            step = multiplier * 10 ** power
            count = ceiling / step
            if abs(count - round(count)) > 1e-6 or not 2 <= round(count) <= 6:
                continue
            score = abs(round(count) - target)
            if best is None or score < best[0] or (score == best[0] and step > best[1]):
                best = (score, step)
    step = best[1] if best else ceiling
    count = round(ceiling / step)
    return [round(i * step, 10) for i in range(count + 1)]


def time_step(span_s: float, max_ticks: int) -> int:
    for step in TIME_STEPS_S:
        if span_s / step <= max(1, max_ticks):
            return step
    return TIME_STEPS_S[-1]


def time_ticks(start: float, end: float, max_ticks: int, utc_offset_s: float | None = None) -> list[float]:
    if end <= start:
        return []
    step = time_step(end - start, max_ticks)
    offset = local_offset(start) if utc_offset_s is None else utc_offset_s
    first = math.ceil((start + offset) / step) * step - offset
    ticks = []
    tick = first
    while tick <= end + EPSILON:
        ticks.append(tick)
        tick += step
    return ticks


def local_offset(t: float) -> float:
    return float(time.localtime(t).tm_gmtoff)


def time_label(t: float, step_s: float) -> str:
    return time.strftime("%H:%M:%S" if step_s < 60 else "%H:%M", time.localtime(t))


def percent_label(value: float, digits: int = 0) -> str:
    return f"{value * 100:.{digits}f}%"


def split_segments(points: Sequence[Point]) -> list[list[XY]]:
    segments: list[list[XY]] = []
    current: list[XY] = []
    for t, value in points:
        if value is None or not math.isfinite(value):
            if current:
                segments.append(current)
            current = []
            continue
        current.append((t, value))
    if current:
        segments.append(current)
    return segments


def monotone_tangents(points: Sequence[XY]) -> list[float]:
    n = len(points)
    if n < 2:
        return [0.0] * n
    dx = [points[i + 1][0] - points[i][0] for i in range(n - 1)]
    slopes = [(points[i + 1][1] - points[i][1]) / dx[i] if dx[i] else 0.0 for i in range(n - 1)]
    tangents = [slopes[0], *((slopes[i - 1] + slopes[i]) / 2 for i in range(1, n - 1)), slopes[-1]]
    for i, slope in enumerate(slopes):
        if slope == 0:
            tangents[i] = tangents[i + 1] = 0.0
            continue
        a, b = tangents[i] / slope, tangents[i + 1] / slope
        if a < 0:
            tangents[i], a = 0.0, 0.0
        if b < 0:
            tangents[i + 1], b = 0.0, 0.0
        magnitude = a * a + b * b
        if magnitude > 9:
            scale = 3 / math.sqrt(magnitude)
            tangents[i] = scale * a * slope
            tangents[i + 1] = scale * b * slope
    return tangents


def bezier_controls(points: Sequence[XY]) -> list[tuple[XY, XY, XY]]:
    tangents = monotone_tangents(points)
    curves = []
    for i in range(len(points) - 1):
        (x0, y0), (x1, y1) = points[i], points[i + 1]
        third = (x1 - x0) / 3
        curves.append(((x0 + third, y0 + tangents[i] * third), (x1 - third, y1 - tangents[i + 1] * third), (x1, y1)))
    return curves


def nearest(times: Sequence[float], t: float) -> int | None:
    if not times:
        return None
    index = bisect.bisect_left(times, t)
    if index == 0:
        return 0
    if index >= len(times):
        return len(times) - 1
    return index if times[index] - t < t - times[index - 1] else index - 1


def crisp(value: float, scale: float, width: float = 1.0) -> float:
    device = round(value * scale)
    if round(width * scale) % 2 == 1:
        device += 0.5
    return device / scale


def ease_out(progress: float) -> float:
    progress = min(1.0, max(0.0, progress))
    return 1 - (1 - progress) ** 3
