import json
import sys
import time
from pathlib import Path

import pytest
from gi.repository import GLib

from monolith_desktop.hostshell import model
from monolith_desktop.hostshell.model import (
    ENV_CONTROLLER_COMMAND,
    HostPairing,
    HostShellError,
    HostShellState,
    append_log,
    cli_error,
    controller_command,
    is_host_health,
    parse_pairing,
    pin_error,
)
from monolith_desktop.hostshell.service import AUTOSTART_SETTING, HostShellService

FAKE_CONTROLLER = r'''
import json, signal, sys, time
from pathlib import Path

state = Path(sys.argv[1])
args = sys.argv[2:]
data = json.loads(state.read_text()) if state.exists() else {"pin": None, "token": "t1"}
if args[:2] == ["host", "pair"]:
    print(json.dumps({"link": "theone://host?token=" + data["token"], "url": "http://127.0.0.1:1", "name": "box", "pinSet": data["pin"] is not None}))
elif args[:2] == ["host", "pin"]:
    pin = sys.stdin.read().strip()
    if not pin.isdigit() or not 6 <= len(pin) <= 12:
        print("error: The PIN must be 6 to 12 digits", file=sys.stderr)
        sys.exit(2)
    data["pin"] = pin
elif args[:2] == ["host", "token"]:
    data["token"] = data["token"] + "x"
elif args[:2] == ["host", "stream"]:
    stream = {"encoding": "h264", "bitRate": 8000000, "maxFps": 60, "maxSize": None, "keyFrameInterval": 2, "jpegQuality": 5, "device": None}
    stream.update(data.get("stream", {}))
    if "--stdin" in args:
        change = json.loads(sys.stdin.read())
        if change.get("bitRate", 1000000) < 250000:
            print("error: Invalid stream settings: bitRate: Too small", file=sys.stderr)
            sys.exit(2)
        data["stream"] = {**data.get("stream", {}), **change}
        stream.update(change)
    devices = [{"serial": "192.168.56.101:5555", "state": "device", "kind": "genymotion", "model": "Google Pixel 3", "hostEmulator": False}]
    print(json.dumps({"stream": stream, "devices": devices}))
elif args[:2] == ["host", "serve"]:
    if data.get("fail"):
        print("error: Could not read the host's Tailscale IPv4 (is tailscale up?)", flush=True)
        sys.exit(2)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    print("INFO  [host-shell] host shell listening url=http://127.0.0.1:1/", flush=True)
    while True:
        time.sleep(0.1)
state.write_text(json.dumps(data))
'''


def pump(until, timeout=10.0):
    deadline = time.monotonic() + timeout
    context = GLib.MainContext.default()
    while not until():
        if time.monotonic() > deadline:
            raise AssertionError("timed out")
        context.iteration(False)
        time.sleep(0.01)


@pytest.fixture
def fake(tmp_path, monkeypatch):
    script = tmp_path / "controller.py"
    script.write_text(FAKE_CONTROLLER)
    state = tmp_path / "state.json"
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "config"))
    monkeypatch.delenv("MONOLITH_DESKTOP_CONFIG", raising=False)
    env = {"PATH": "/usr/bin:/bin", "HOME": str(tmp_path), ENV_CONTROLLER_COMMAND: f"{sys.executable} {script} {state}"}
    return env, state


def test_controller_command_prefers_override_then_checkout(tmp_path):
    assert controller_command({ENV_CONTROLLER_COMMAND: "bun /x/index.ts --flag"}) == ["bun", "/x/index.ts", "--flag"]
    with pytest.raises(HostShellError, match="not in this checkout"):
        controller_command({"PATH": ""}, tmp_path)
    entry = tmp_path / model.CONTROLLER_ENTRY
    entry.parent.mkdir(parents=True)
    entry.write_text("")
    with pytest.raises(HostShellError, match="Bun is not installed"):
        controller_command({"PATH": "", "HOME": str(tmp_path)}, tmp_path)
    bun = tmp_path / ".bun" / "bin" / "bun"
    bun.parent.mkdir(parents=True)
    bun.write_text("#!/bin/sh\n")
    bun.chmod(0o755)
    assert controller_command({"PATH": "", "HOME": str(tmp_path)}, tmp_path) == [str(bun), str(entry)]


def test_parse_pairing_reads_the_json_line():
    out = "noise\n" + json.dumps({"link": "theone://host?x", "url": "http://100.1.2.3:7701", "name": "arch", "pinSet": True})
    assert parse_pairing(out) == HostPairing("theone://host?x", "http://100.1.2.3:7701", "arch", True)
    assert parse_pairing(json.dumps({"link": "l", "url": "u"})).pin_set is False
    with pytest.raises(HostShellError):
        parse_pairing("not json")


def test_cli_error_prefers_flagged_lines():
    assert cli_error("INFO starting\nerror: tailscale is not installed\n") == "tailscale is not installed"
    assert cli_error("something broke\n") == "something broke"
    assert cli_error("", 3) == "The controller exited with code 3"


def test_pin_error_and_helpers():
    assert pin_error("12345", "12345") == "pin"
    assert pin_error("12345a", "12345a") == "pin"
    assert pin_error("123456", "123457") == "repeat"
    assert pin_error("123456789012", "123456789012") is None
    assert is_host_health({"ok": True, "service": "host-shell"})
    assert not is_host_health({"ok": True, "service": "controller"})
    assert append_log(("a", "b"), "c", limit=2) == ("b", "c")
    assert HostShellState(status="external", pairing=HostPairing("l", "u", "n", True)).ready
    assert not HostShellState(status="running", pairing=HostPairing("l", "u", "n", False)).ready


def test_pin_pair_and_rotate(fake):
    env, state = fake
    service = HostShellService(env)
    service.refresh()
    pump(lambda: service.state.value.pairing is not None)
    assert service.state.value.pairing.pin_set is False
    assert service.state.value.status == "stopped"

    errors = []
    service.set_pin("12", lambda: None, errors.append)
    pump(lambda: errors)
    assert str(errors[0]) == "The PIN must be 6 to 12 digits"

    done = []
    service.set_pin("24681357", lambda: done.append(True), errors.append)
    pump(lambda: done and service.state.value.pairing.pin_set)
    assert json.loads(state.read_text())["pin"] == "24681357"

    old = service.state.value.pairing.link
    service.rotate_token(lambda: done.append(True), errors.append)
    pump(lambda: service.state.value.pairing.link != old)


def test_serve_lifecycle(fake):
    env, _state = fake
    service = HostShellService(env)
    service.start()
    assert service.state.value.status == "starting"
    pump(lambda: service.state.value.status == "running")
    assert any("listening" in line for line in service.state.value.log)
    service.stop()
    pump(lambda: service.state.value.status == "stopped")
    assert service.state.value.error is None


def test_serve_failure_surfaces_the_error(fake):
    env, state = fake
    state.write_text(json.dumps({"pin": None, "token": "t", "fail": True}))
    service = HostShellService(env)
    service.start()
    pump(lambda: service.state.value.status == "failed")
    assert service.state.value.error == "Could not read the host's Tailscale IPv4 (is tailscale up?)"


def test_autostart_is_persisted(fake):
    env, _state = fake
    service = HostShellService(env)
    assert service.state.value.autostart is False
    service.set_autostart(True)
    assert HostShellService(env).state.value.autostart is True
    from monolith_desktop.config.storage import read_settings

    assert read_settings()[AUTOSTART_SETTING] is True
    service.shutdown()


def test_stream_settings_round_trip(fake):
    env, state = fake
    service = HostShellService(env)
    loaded, errors = [], []
    service.stream(loaded.append, errors.append)
    pump(lambda: loaded)
    assert loaded[0].settings["encoding"] == "h264"
    assert loaded[0].devices[0]["kind"] == "genymotion"

    service.update_stream({"bitRate": 4_000_000, "device": "192.168.56.101:5555"}, loaded.append, errors.append)
    pump(lambda: len(loaded) == 2)
    assert loaded[1].settings["bitRate"] == 4_000_000
    assert json.loads(state.read_text())["stream"] == {"bitRate": 4_000_000, "device": "192.168.56.101:5555"}

    service.update_stream({"bitRate": 1}, loaded.append, errors.append)
    pump(lambda: errors)
    assert str(errors[0]) == "Invalid stream settings: bitRate: Too small"
