from monolith_desktop.pages.projects import emulator

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
