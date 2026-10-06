import pytest

from monolith_desktop.api.errors import ApiError, NetworkError
from monolith_desktop.hostshell import HostPairing, HostShellState
from monolith_desktop.hostshell.android import HostAndroidClient, HostRequestError, session_expiry
from monolith_desktop.hostshell.model import host_token
from monolith_desktop.pages.projects import emulator
from monolith_desktop.pages.projects.labels import DETAIL, EMULATOR

TARGETS = [
    {"target": "expo-device", "label": "Expo on the phone · apps/mobile", "dir": "apps/mobile", "available": True, "reason": None, "viewer": "deeplink", "actions": []},
    {"target": "expo-android", "label": "Android emulator · apps/mobile", "dir": "apps/mobile", "available": False, "reason": "Start the emulator on the host", "viewer": "android", "actions": []},
]


def _run(target, state):
    return {"id": f"app_{target}_{state}", "projectId": "p", "target": target, "state": state}


class FakeClient:
    def __init__(self, runs, serial="127.0.0.1:44595"):
        self.runs = runs
        self.serial = serial
        self.started = []

    def list_app_runs(self, project_id):
        return self.runs

    def start_app_run(self, project_id, target):
        self.started.append((project_id, target))
        return _run(target, "starting")

    def android_status(self):
        return {"linked": True, "emulator": {"serial": self.serial} if self.serial else None}


def test_android_target_picks_the_emulator_viewer():
    assert emulator.android_target(TARGETS)["target"] == "expo-android"
    assert emulator.android_target(TARGETS[:1]) is None
    assert emulator.android_target(None) is None


def test_live_run_ignores_ended_runs_and_other_targets():
    runs = [_run("expo-android", "failed"), _run("expo-device", "ready"), _run("expo-android", "ready")]
    assert emulator.live_run(runs, "expo-android")["id"] == "app_expo-android_ready"
    assert emulator.live_run(runs[:2], "expo-android") is None


def test_run_on_emulator_starts_once_and_reports_the_serial():
    client = FakeClient([])
    run, started, serial = emulator.run_on_emulator(client, "p", "expo-android")
    assert (run["state"], started, serial) == ("starting", True, "127.0.0.1:44595")
    assert client.started == [("p", "expo-android")]

    client = FakeClient([_run("expo-android", "ready")], serial=None)
    run, started, serial = emulator.run_on_emulator(client, "p", "expo-android")
    assert (run["state"], started, serial) == ("ready", False, None)
    assert client.started == []


def test_scrcpy_command_and_error():
    assert emulator.scrcpy_command("127.0.0.1:1", "x · Android emulator") == [
        "scrcpy", "--serial", "127.0.0.1:1", "--window-title", "x · Android emulator", "--no-audio",
    ]
    assert emulator.scrcpy_error("INFO: hi\nERROR: Could not find any ADB device\nWARN: x\n", 1) == "Could not find any ADB device"
    assert emulator.scrcpy_error("", 2) == "scrcpy exited with code 2"


SANDBOX = "http://127.0.0.1:7700"
PAIRING = HostPairing(link="theone://host?url=http%3A%2F%2F127.0.0.1%3A7710&token=hosttok", url="http://127.0.0.1:7710", name="box", pin_set=True)


def _target(available=True, reason=None, dir="apps/mobile"):
    return {**TARGETS[1], "available": available, "reason": reason, "dir": dir}


def _status(state="stopped", isolated=True, avd=None, avds=("Pixel_8",), link_url=None, connected=False, available=True, isolation="netns"):
    return {
        "available": available,
        "reason": None if available else "The Android SDK emulator is not installed",
        "sdkRoot": "/sdk",
        "isolation": isolation,
        "avds": list(avds),
        "scrcpy": True,
        "ffmpeg": True,
        "emulator": {
            "state": state, "avd": avd, "serial": "127.0.0.1:40001" if state == "running" else None, "managed": True,
            "isolated": isolated, "width": None, "height": None, "startedAt": None, "error": "boom" if state == "failed" else None,
        },
        "link": {"configured": link_url is not None, "sandboxUrl": link_url, "connected": connected, "lastError": None},
    }


def test_display_button_for_android_targets():
    state = emulator.display_button([_target()], [], "node")
    assert (state.mode, state.label, state.icon) == ("emulator", EMULATOR["run"], "smartphone")
    assert state.tooltip == EMULATOR["tooltip_dir"].format(dir="apps/mobile")

    assert emulator.display_button([_target()], [_run("expo-android", "ready")], "node").label == EMULATOR["show"]

    fixable = emulator.display_button([_target(False, "Start the emulator on the host")], None, "expo")
    assert fixable.tooltip == EMULATOR["tooltip_setup"].format(reason="Start the emulator on the host")
    assert emulator.display_button([_target(False, "adb is not installed")], None, "expo").tooltip == "adb is not installed"


def test_display_button_keeps_display_for_other_projects_and_never_for_android_ones():
    for targets, error in (([], None), (None, None), (None, ApiError(404, "not_found", "No route"))):
        state = emulator.display_button(targets, None, "node", error)
        assert (state.mode, state.label, state.icon) == ("display", DETAIL["display"], "display")

    assert emulator.display_button(None, None, "expo") == emulator.DisplayButton("unsupported", EMULATOR["run"], "smartphone", None)
    assert emulator.display_button([], None, "react-native").tooltip == EMULATOR["no_target"]
    assert emulator.display_button(None, None, "expo", ApiError(404, "not_found", "No route")).tooltip == EMULATOR["outdated"]
    assert emulator.display_button(None, None, "android", NetworkError("down")).tooltip == EMULATOR["no_targets"].format(error="down")


def test_host_fixable_reasons():
    assert all(emulator.host_fixable(_target(False, reason)) for reason in emulator.HOST_FIXABLE_REASONS)
    assert not emulator.host_fixable(_target(False, "adb is not installed"))
    assert not emulator.host_fixable(_target(True))


def test_host_blocker():
    assert emulator.host_blocker(HostShellState(status="running", pairing=PAIRING)) is None
    assert emulator.host_blocker(HostShellState(status="external", pairing=PAIRING)) is None
    assert emulator.host_blocker(HostShellState(status="stopped", pairing=PAIRING)) == EMULATOR["host_stopped"]
    assert emulator.host_blocker(HostShellState(status="failed", error="x")) == EMULATOR["host_stopped"]
    assert emulator.host_blocker(HostShellState(status="starting")) == EMULATOR["host_loading"]
    no_pin = HostPairing(PAIRING.link, PAIRING.url, PAIRING.name, pin_set=False)
    assert emulator.host_blocker(HostShellState(status="running", pairing=no_pin)) == EMULATOR["host_no_pin"]


def test_plan_starts_and_links_a_stopped_emulator():
    assert emulator.plan_emulator(_status(), SANDBOX) == emulator.EmulatorPlan(avd="Pixel_8", link=True)
    plan = emulator.plan_emulator(_status("failed", avd="Tablet", avds=("Pixel_8", "Tablet"), link_url=SANDBOX + "/", connected=True), SANDBOX)
    assert plan == emulator.EmulatorPlan(avd="Tablet")
    assert not plan.needs_confirm


def test_plan_reuses_an_isolated_emulator():
    assert emulator.plan_emulator(_status("running", link_url=SANDBOX, connected=True), SANDBOX) == emulator.EmulatorPlan()
    assert emulator.plan_emulator(_status("starting"), SANDBOX) == emulator.EmulatorPlan(link=True)
    assert emulator.plan_emulator(_status("running", link_url=SANDBOX, connected=False), SANDBOX) == emulator.EmulatorPlan(link=True)


def test_plan_restarts_an_unisolated_emulator_and_confirms_replacing_a_live_link():
    plan = emulator.plan_emulator(_status("running", isolated=False, avd="Pixel_8"), SANDBOX)
    assert plan == emulator.EmulatorPlan(stop=True, avd="Pixel_8", link=True)
    assert plan.needs_confirm

    plan = emulator.plan_emulator(_status("running", link_url="https://other.ts.net", connected=True), SANDBOX)
    assert plan == emulator.EmulatorPlan(link=True, replaces="https://other.ts.net")
    assert plan.needs_confirm
    assert emulator.plan_emulator(_status("running", link_url="https://other.ts.net"), SANDBOX).replaces is None


def test_plan_blocks_what_the_desktop_cannot_fix():
    assert emulator.plan_emulator(_status(available=False), SANDBOX).blocked == "The Android SDK emulator is not installed"
    assert emulator.plan_emulator(_status(isolation="none"), SANDBOX).blocked == EMULATOR["isolation_off"]
    assert emulator.plan_emulator(_status("stopping"), SANDBOX).blocked == EMULATOR["stopping"]
    assert emulator.plan_emulator(_status(avds=()), SANDBOX).blocked == EMULATOR["no_avd"]


class FakeHost:
    def __init__(self, statuses):
        self.statuses = list(statuses)
        self.calls = []

    def status(self):
        return self.statuses.pop(0) if len(self.statuses) > 1 else self.statuses[0]

    def stop_emulator(self):
        self.calls.append("stop")

    def start_emulator(self, avd):
        self.calls.append(("start", avd))

    def link_sandbox(self, url, token):
        self.calls.append(("link", url, token))


class FakeSandbox:
    base_url = SANDBOX
    token = "sandbox-token"

    def __init__(self, offered_after=0):
        self.polls = 0
        self.offered_after = offered_after

    def list_run_targets(self, project_id):
        self.polls += 1
        return [TARGETS[0], _target(self.polls > self.offered_after)]


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


def test_prepare_emulator_restarts_links_and_waits_for_the_sandbox():
    ready = _status("running", link_url=SANDBOX, connected=True)
    host = FakeHost([_status("stopping", isolated=False), _status("stopped"), _status("starting"), ready])
    sandbox, clock, stages = FakeSandbox(offered_after=1), Clock(), []
    plan = emulator.EmulatorPlan(stop=True, avd="Pixel_8", link=True)
    emulator.prepare_emulator(host, sandbox, "p", "expo-android", plan, stages.append, clock.sleep, clock)
    assert host.calls == ["stop", ("start", "Pixel_8"), ("link", SANDBOX, "sandbox-token")]
    assert stages == ["stopping", "starting", "linking", "booting"]
    assert sandbox.polls == 2


def test_prepare_emulator_times_out_and_reports_a_failed_boot():
    clock = Clock()
    with pytest.raises(emulator.EmulatorTimeout, match="did not boot"):
        emulator.prepare_emulator(FakeHost([_status("starting")]), FakeSandbox(), "p", "expo-android", emulator.EmulatorPlan(), [].append, clock.sleep, clock)
    assert clock.now >= emulator.BOOT_TIMEOUT_S

    with pytest.raises(RuntimeError, match="The emulator failed: boom"):
        emulator.prepare_emulator(FakeHost([_status("failed")]), FakeSandbox(), "p", "expo-android", emulator.EmulatorPlan(), [].append, clock.sleep, clock)

    clock = Clock()
    ready = _status("running", link_url=SANDBOX, connected=True)
    with pytest.raises(emulator.EmulatorTimeout, match="did not pick up"):
        emulator.prepare_emulator(FakeHost([ready]), FakeSandbox(offered_after=10_000), "p", "expo-android", emulator.EmulatorPlan(), [].append, clock.sleep, clock)


def test_host_token_session_expiry_and_host_errors():
    assert host_token(PAIRING.link) == "hosttok"
    with pytest.raises(Exception, match="no token"):
        host_token("theone://host?url=x")
    assert session_expiry({"session": "s", "expiresAt": "1970-01-01T00:01:00.000Z"}) == 60.0

    error = HostRequestError("Wrong PIN (4 attempts left)")
    assert (str(error), error.auth) == ("Wrong PIN (4 attempts left)", False)
    client = HostAndroidClient("http://127.0.0.1:9", "session")
    with pytest.raises(HostRequestError, match="not answering at http://127.0.0.1:9"):
        client.status()
