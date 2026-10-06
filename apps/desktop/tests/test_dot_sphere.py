import math

import pytest

from monolith_desktop.widgets.dot_sphere import (
    DEPTH_BANDS,
    FRAMES_PER_TURN,
    TURN,
    band_opacity,
    frame_angle,
    sphere_dots,
    sphere_points,
)


def test_sphere_points_lie_on_the_unit_sphere():
    points = sphere_points(24)
    assert len(points) == 24
    for point in points:
        assert math.isclose(point.x ** 2 + point.y ** 2 + point.z ** 2, 1.0, abs_tol=1e-9)


def test_dots_stay_inside_the_canvas_and_their_bands():
    size, dot_radius = 20, 1.0
    for step in range(FRAMES_PER_TURN):
        for dot in sphere_dots(sphere_points(24), step / FRAMES_PER_TURN * TURN, size / 2, size / 2 - dot_radius, dot_radius):
            assert 0 <= dot.band < DEPTH_BANDS
            assert dot.radius <= dot_radius
            assert 0 <= dot.x - dot.radius and dot.x + dot.radius <= size
            assert 0 <= dot.y - dot.radius and dot.y + dot.radius <= size


def test_nearer_bands_are_brighter():
    opacities = [band_opacity(band) for band in range(DEPTH_BANDS)]
    assert opacities == sorted(opacities)
    assert 0 < opacities[0] and opacities[-1] <= 1


@pytest.mark.parametrize(("seconds", "expected"), [(0.0, 0.0), (3.6, math.pi), (7.2, 0.0), (0.44, TURN * 5 / FRAMES_PER_TURN)])
def test_frame_angle_turns_once_per_period(seconds, expected):
    assert math.isclose(frame_angle(seconds, 7200), expected, abs_tol=1e-9)
