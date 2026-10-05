import shutil
import subprocess
import threading
from collections.abc import Callable

from ...api.client import ControllerClient
from ...api.tasks import call_on_main
from ...api.types import LIVE_APP_RUN_STATES, AppRun, RunTargetInfo

SCRCPY = "scrcpy"
STDERR_TAIL = 20


def android_target(targets: list[RunTargetInfo] | None) -> RunTargetInfo | None:
    """The run target that installs the project on the Android emulator, if the project has one."""
    return next((target for target in targets or [] if target.get("viewer") == "android"), None)


def live_run(runs: list[AppRun] | None, target: str) -> AppRun | None:
    return next((run for run in runs or [] if run["target"] == target and run["state"] in LIVE_APP_RUN_STATES), None)


def run_on_emulator(client: ControllerClient, project_id: str, target: str) -> tuple[AppRun, bool, str | None]:
    """Starts the target unless a run of it is live; returns the run, whether it was started, and the host emulator serial."""
    run = live_run(client.list_app_runs(project_id), target)
    started = run is None
    if run is None:
        run = client.start_app_run(project_id, target)
    emulator = client.android_status().get("emulator") or {}
    return run, started, emulator.get("serial")


def scrcpy_command(serial: str, title: str) -> list[str]:
    return [SCRCPY, "--serial", serial, "--window-title", title, "--no-audio"]


def scrcpy_error(stderr: str, code: int) -> str:
    lines = [line.strip() for line in stderr.splitlines() if line.strip()]
    errors = [line for line in lines if line.startswith("ERROR:")]
    message = (errors or lines or [""])[-1].removeprefix("ERROR:").strip()
    return message or f"scrcpy exited with code {code}"


class EmulatorViewer:
    """One local scrcpy window on the host emulator; opening it again while it is up does nothing."""

    def __init__(self) -> None:
        self._process: subprocess.Popen[str] | None = None

    @staticmethod
    def installed() -> bool:
        return shutil.which(SCRCPY) is not None

    def open(self, serial: str, title: str, on_error: Callable[[str], None]) -> None:
        if self._process is not None and self._process.poll() is None:
            return
        process = subprocess.Popen(
            scrcpy_command(serial, title),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
        self._process = process
        threading.Thread(target=self._wait, args=(process, on_error), daemon=True).start()

    def _wait(self, process: subprocess.Popen[str], on_error: Callable[[str], None]) -> None:
        assert process.stderr is not None
        tail: list[str] = []
        for line in process.stderr:
            tail = [*tail, line][-STDERR_TAIL:]
        code = process.wait()
        if code != 0:
            call_on_main(on_error, scrcpy_error("".join(tail), code))


viewer = EmulatorViewer()
