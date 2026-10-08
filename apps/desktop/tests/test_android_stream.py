import json

import pytest

from tesseract_desktop.hostshell import stream
from tesseract_desktop.hostshell.model import HostShellError
from tesseract_desktop.hostshell.stream import StreamState, parse_stream

GENYMOTION = {"serial": "192.168.56.101:5555", "state": "device", "kind": "genymotion", "model": "Google Pixel 3", "hostEmulator": False}
EMULATOR = {"serial": "emulator-5554", "state": "device", "kind": "emulator", "model": "sdk gphone64", "hostEmulator": True}
PHONE = {"serial": "R5CT20", "state": "unauthorized", "kind": "usb", "model": None, "hostEmulator": False}


def test_parse_stream_fills_defaults_and_rejects_noise():
    out = "warning: x\n" + json.dumps({"stream": {"maxFps": 30}, "devices": [GENYMOTION]})
    state = parse_stream(out)
    assert state.settings == {**stream.DEFAULTS, "maxFps": 30}
    assert state.devices == (GENYMOTION,)
    assert parse_stream(json.dumps({"stream": {}})).devices == ()
    with pytest.raises(HostShellError):
        parse_stream("nope")
    with pytest.raises(HostShellError):
        parse_stream(json.dumps({"devices": []}))


def test_device_options_list_the_host_emulator_first_and_keep_a_missing_saved_device():
    state = StreamState({**stream.DEFAULTS, "device": "10.0.0.9:5555"}, (EMULATOR, GENYMOTION, PHONE))
    assert stream.device_options(state) == [
        (stream.HOST_EMULATOR, "Host emulator"),
        ("192.168.56.101:5555", "Google Pixel 3 · Genymotion · 192.168.56.101:5555"),
        ("R5CT20", "R5CT20 · USB · R5CT20 · unauthorized"),
        ("10.0.0.9:5555", "10.0.0.9:5555 · not connected"),
    ]
    assert stream.device_value(stream.device_id(None)) is None
    assert stream.device_value(stream.device_id("R5CT20")) == "R5CT20"


def test_size_and_bit_rate_conversions():
    assert stream.max_size_value(stream.max_size_id(None)) is None
    assert stream.max_size_value(stream.max_size_id(1080)) == 1080
    assert [option_id for option_id, _ in stream.max_size_options()][:2] == [stream.VIEWER_SIZE, "720"]
    assert stream.bit_rate(stream.mbit(8_000_000)) == 8_000_000
    assert stream.bit_rate(2.5) == 2_500_000


def test_spin_row_reports_only_user_edits():
    from tesseract_desktop.widgets.preference_rows import SpinRow

    changes = []
    row = SpinRow("Bitrate", None, (0.5, 50.0), 0.5, changes.append, 1)
    row.set_value(8.0)
    assert row.value == 8.0
    assert changes == []
    row._spin.set_value(9.5)
    assert changes == [9.5]


class FakeTask:
    done = True

    def cancel(self) -> None:
        pass


class FakeStreamService:
    def __init__(self) -> None:
        self.state = StreamState(dict(stream.DEFAULTS), (EMULATOR, GENYMOTION))
        self.updates: list[dict] = []

    def stream(self, on_success, _on_error):
        on_success(self.state)
        return FakeTask()

    def update_stream(self, change, on_success, _on_error):
        self.updates.append(change)
        self.state = StreamState({**self.state.settings, **change}, self.state.devices)
        on_success(self.state)
        return FakeTask()


def test_page_keeps_edits_as_a_draft_until_saved():
    from types import SimpleNamespace

    from gi.repository import Adw

    from tesseract_desktop.preferences import android_stream

    Adw.init()
    service = FakeStreamService()
    toasts = []
    page = android_stream.AndroidStreamPreferences(SimpleNamespace(host_shell=service), SimpleNamespace(add_toast=toasts.append))

    assert page._device.selected_id == stream.HOST_EMULATOR
    assert not page._save.get_sensitive()
    page._device.select("192.168.56.101:5555")
    page._device.notify("selected")
    page._max_fps._spin.set_value(30)
    page._encoding.set_selected(1)
    assert service.updates == []
    assert page._save.get_sensitive()

    page._on_save()
    assert service.updates == [{"device": "192.168.56.101:5555", "maxFps": 30, "encoding": "mjpeg"}]
    assert not page._save.get_sensitive()
    assert len(toasts) == 1

    page._reset()
    assert page._max_fps.value == 60
    assert service.state.settings["maxFps"] == 30
    page._on_save()
    assert service.state.settings == stream.DEFAULTS


def test_changes_keep_only_differences():
    assert stream.changes(stream.DEFAULTS, {"maxFps": 60, "bitRate": 1_000_000}) == {"bitRate": 1_000_000}
