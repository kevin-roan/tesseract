import pytest

from tesseract_desktop.widgets.charts.animation import Tween
from tesseract_desktop.widgets.charts.scale import (
    bezier_controls,
    crisp,
    monotone_tangents,
    nearest,
    nice_ceiling,
    percent_label,
    split_segments,
    time_label,
    time_step,
    time_ticks,
    value_ticks,
)


@pytest.mark.parametrize(
    ("peak", "ceiling"),
    [(0.0, 1.0), (0.5, 1.0), (0.96, 1.0), (0.97, 1.25), (1.1, 1.25), (1.3, 1.5), (1.87, 2.0), (2.85, 3.0), (2.9, 4.0), (7.0, 8.0),
     (9.9, 12.5), (float("nan"), 1.0)],
)
def test_nice_ceiling_never_below_floor_and_leaves_headroom(peak, ceiling):
    assert nice_ceiling(peak) == pytest.approx(ceiling)


@pytest.mark.parametrize(
    ("ceiling", "ticks"),
    [
        (1.0, [0, 0.25, 0.5, 0.75, 1.0]),
        (1.25, [0, 0.25, 0.5, 0.75, 1.0, 1.25]),
        (1.5, [0, 0.5, 1.0, 1.5]),
        (2.0, [0, 0.5, 1.0, 1.5, 2.0]),
        (3.0, [0, 1, 2, 3]),
        (5.0, [0, 1, 2, 3, 4, 5]),
        (8.0, [0, 2, 4, 6, 8]),
    ],
)
def test_value_ticks_divide_the_ceiling_evenly(ceiling, ticks):
    assert value_ticks(ceiling) == pytest.approx(ticks)


def test_value_ticks_degenerate():
    assert value_ticks(0) == [0.0]


def test_time_step_matches_available_space():
    assert time_step(300, 8) == 60
    assert time_step(900, 8) == 120
    assert time_step(3600, 8) == 600
    assert time_step(3600, 2) == 1800
    assert time_step(10**6, 1) == 7200


def test_time_ticks_align_to_wall_clock():
    ticks = time_ticks(1000.5, 1600, 10, utc_offset_s=0)
    assert ticks == [1020, 1080, 1140, 1200, 1260, 1320, 1380, 1440, 1500, 1560]
    shifted = time_ticks(0, 3600, 6, utc_offset_s=300)
    assert shifted == [300, 900, 1500, 2100, 2700, 3300]
    assert time_ticks(10, 10, 4) == []


def test_labels():
    assert percent_label(0.855) == "86%"
    assert percent_label(1.5) == "150%"
    assert len(time_label(0, 60)) == 5
    assert len(time_label(0, 30)) == 8


def test_split_segments_breaks_on_missing_values():
    points = [(0, 1.0), (1, 2.0), (2, None), (3, 3.0), (4, float("nan")), (5, None), (6, 4.0), (7, 5.0)]
    assert split_segments(points) == [[(0, 1.0), (1, 2.0)], [(3, 3.0)], [(6, 4.0), (7, 5.0)]]
    assert split_segments([]) == []


def test_monotone_curve_does_not_overshoot():
    points = [(0, 0.0), (1, 1.0), (2, 1.0), (3, 0.0), (4, 5.0), (5, 5.2)]
    curves = bezier_controls(points)
    assert len(curves) == len(points) - 1
    for (x0, y0), ((c1x, c1y), (c2x, c2y), (x1, y1)) in zip(points, curves):
        low, high = min(y0, y1), max(y0, y1)
        assert low - 1e-9 <= c1y <= high + 1e-9
        assert low - 1e-9 <= c2y <= high + 1e-9
        assert x0 < c1x < c2x < x1
    assert monotone_tangents([(0, 1.0)]) == [0.0]
    assert monotone_tangents([(0, 1.0), (1, 1.0), (2, 1.0)]) == [0.0, 0.0, 0.0]


def test_nearest_snaps_to_closest_time():
    times = [0.0, 5.0, 10.0]
    assert nearest(times, -3) == 0
    assert nearest(times, 2.4) == 0
    assert nearest(times, 2.6) == 1
    assert nearest(times, 99) == 2
    assert nearest([], 1) is None


def test_crisp_aligns_lines_to_device_pixels():
    assert crisp(10.2, 1) == 10.5
    assert crisp(10.2, 2) == 10.0
    assert crisp(10.2, 2, 1.5) == 10.25
    assert crisp(10.2, 1, 2) == 10.0


def test_tween_eases_toward_target():
    tween = Tween(0.0, duration_s=1.0)
    tween.set(10.0, now=0.0)
    assert tween.running(0.5)
    assert 0 < tween.value(0.5) < 10
    assert tween.value(1.0) == 10.0
    assert not tween.running(1.0)
    tween.set(20.0, now=2.0, animate=False)
    assert tween.value(2.0) == 20.0
    assert not tween.running(2.0)
