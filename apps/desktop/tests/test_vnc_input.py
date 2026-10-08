import pytest

from tesseract_desktop.vnc.framebuffer import Framebuffer, Rect, union
from tesseract_desktop.vnc.input import (
    KEY_COMBOS,
    XK_ALT_L,
    XK_CONTROL_L,
    XK_DELETE,
    XK_ISO_LEFT_TAB,
    XK_TAB,
    KeyTracker,
    WheelAccumulator,
    button_bit,
    combo_events,
    fit_geometry,
    keysym_for,
    to_framebuffer,
)


def test_keysym_passthrough_and_aliases():
    assert keysym_for(0x61) == 0x61
    assert keysym_for(0xFFE1) == 0xFFE1
    assert keysym_for(0x010020AC) == 0x010020AC
    assert keysym_for(XK_ISO_LEFT_TAB) == XK_TAB


def test_button_bits_cover_wheel_buttons():
    assert [button_bit(button) for button in range(1, 9)] == [1, 2, 4, 8, 16, 32, 64, 128]
    assert button_bit(9) == 0


def test_combo_presses_then_releases_in_reverse():
    assert combo_events(KEY_COMBOS["ctrl-alt-delete"]) == [
        (XK_CONTROL_L, True), (XK_ALT_L, True), (XK_DELETE, True),
        (XK_DELETE, False), (XK_ALT_L, False), (XK_CONTROL_L, False),
    ]


def test_key_tracker_releases_the_keysym_that_was_pressed():
    keys = KeyTracker()
    assert keys.press(38, 0x41) == 0x41
    assert keys.press(38, 0x61) == 0x41
    assert keys.release(38) == 0x41
    assert keys.release(38) is None
    keys.press(50, 0xFFE1)
    keys.press(38, 0x41)
    assert keys.release_all() == [0x41, 0xFFE1]
    assert keys.release_all() == []


def test_wheel_accumulates_smooth_deltas():
    wheel = WheelAccumulator()
    assert wheel.clicks(0, 0.4) == []
    assert wheel.clicks(0, 0.7) == [5]
    assert wheel.clicks(0, -2.1) == [4, 4]
    assert wheel.clicks(1.0, 0) == [7]
    assert wheel.clicks(-1.0, 0) == [6]
    wheel.reset()
    assert wheel.clicks(0, 0.5) == []


def test_fit_geometry_letterboxes_and_centres():
    assert fit_geometry(1600, 900, 800, 800, True) == (0.5, 0.0, 175.0)
    assert fit_geometry(1600, 900, 1600, 900, True) == (1.0, 0.0, 0.0)
    assert fit_geometry(1600, 900, 2000, 900, False) == (1.0, 200.0, 0.0)
    assert fit_geometry(1600, 900, 800, 400, False) == (1.0, 0.0, 0.0)
    assert fit_geometry(0, 0, 800, 400, True) == (1.0, 0.0, 0.0)


def test_to_framebuffer_maps_through_scale_and_clamps():
    geometry = fit_geometry(1600, 900, 800, 800, True)
    assert to_framebuffer(0, 175, geometry, 1600, 900) == (0, 0)
    assert to_framebuffer(400, 400, geometry, 1600, 900) == (800, 450)
    assert to_framebuffer(799.9, 624.9, geometry, 1600, 900) == (1599, 899)
    assert to_framebuffer(-10, 0, geometry, 1600, 900) == (0, 0)
    assert to_framebuffer(900, 900, geometry, 1600, 900) == (1599, 899)


def test_framebuffer_fill_copy_region():
    fb = Framebuffer(3, 2)
    fb.fill(1, 0, 2, 2, b"\x01\x02\x03\x00")
    assert fb.region(1, 1, 2, 1) == b"\x01\x02\x03\x00" * 2
    assert fb.region(0, 0, 1, 2) == bytes(8)
    fb.fill(0, 0, 3, 2, b"\x09\x09\x09\x00")
    assert fb.data == bytearray(b"\x09\x09\x09\x00" * 6)
    assert fb.contains(0, 0, 3, 2) and not fb.contains(1, 1, 3, 1) and not fb.contains(-1, 0, 1, 1)


def test_union_of_damage():
    assert union([Rect(0, 0, 2, 2), Rect(5, 1, 1, 4)]) == Rect(0, 0, 6, 5)
    assert union([Rect(0, 0, 0, 5)]) is None
    assert union([]) is None


@pytest.mark.parametrize("chunk", [1, 7, 4096, 65536])
def test_large_raw_update_in_chunks(chunk):
    import struct

    from tesseract_desktop.vnc.protocol import Encoding
    from test_vnc_client import connected, rect, update

    client, _, events = connected(64, 48)
    pixels = bytes(range(256)) * (64 * 48 * 4 // 256)
    stream = update(rect(0, 0, 64, 48, Encoding.RAW, pixels))
    for start in range(0, len(stream), chunk):
        client.feed(stream[start : start + chunk])
    assert bytes(client.framebuffer.data) == pixels
    assert events.calls == [("update", [Rect(0, 0, 64, 48)])]
    assert struct.calcsize(">HHHHi") == 12
