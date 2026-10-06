import shutil
import subprocess
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from ...api.client import ControllerClient
from ...api.errors import ApiError
from ...api.tasks import call_on_main
from ...api.types import LIVE_APP_RUN_STATES, AndroidLinkInfo, AppRun, HostAndroidStatus, RunTargetInfo
from ...hostshell import HostShellState
from ...hostshell.android import HostAndroidClient
from .labels import DETAIL, EMULATOR

SCRCPY = "scrcpy"
STDERR_TAIL = 20
ANDROID_FRAMEWORKS = ("expo", "react-native", "android")
HOST_FIXABLE_REASONS = (
    "Link the host Android emulator first",
    "Start the emulator on the host",
    "The host emulator is not isolated; start it from the app",
)
POLL_S = 2.0
STOP_TIMEOUT_S = 60.0
BOOT_TIMEOUT_S = 330.0
TARGET_TIMEOUT_S = 60.0

ButtonMode = Literal["display", "emulator", "unsupported"]
Stage = Literal["stopping", "starting", "linking", "booting"]


@dataclass(frozen=True)
class DisplayButton:
    mode: ButtonMode
    label: str
    icon: str
    tooltip: str | None


@dataclass(frozen=True)
class EmulatorPlan:
    """What the host daemon must do before the sandbox can use its emulator; `blocked` says why it can't."""

    stop: bool = False
    avd: str | None = None
    link: bool = False
    replaces: str | None = None
    blocked: str | None = None

    @property
    def needs_confirm(self) -> bool:
        return self.stop or self.replaces is not None


def android_target(targets: list[RunTargetInfo] | None) -> RunTargetInfo | None:
    """The run target that installs the project on the Android emulator, if the project has one."""
    return next((target for target in targets or [] if target.get("viewer") == "android"), None)


def host_fixable(target: RunTargetInfo) -> bool:
    return not target["available"] and target.get("reason") in HOST_FIXABLE_REASONS


def display_button(
    targets: list[RunTargetInfo] | None,
    runs: list[AppRun] | None,
    framework: str | None,
    targets_error: BaseException | None = None,
) -> DisplayButton:
    """Android projects get the emulator action and never the sandbox display."""
    target = android_target(targets)
    if target is None:
        if framework not in ANDROID_FRAMEWORKS:
            return DisplayButton("display", DETAIL["display"], "display", None)
        if targets is None and targets_error is None:
            tooltip = None
        elif targets_error is None:
            tooltip = EMULATOR["no_target"]
        elif isinstance(targets_error, ApiError) and targets_error.status == 404:
            tooltip = EMULATOR["outdated"]
        else:
            tooltip = EMULATOR["no_targets"].format(error=targets_error)
        return DisplayButton("unsupported", EMULATOR["run"], "smartphone", tooltip)
    running = live_run(runs, target["target"]) is not None
    if target["available"]:
        tooltip = EMULATOR["tooltip_dir"].format(dir=target["dir"]) if target.get("dir") else EMULATOR["tooltip"]
    elif host_fixable(target):
        tooltip = EMULATOR["tooltip_setup"].format(reason=target["reason"])
    else:
        tooltip = target["reason"]
    return DisplayButton("emulator", EMULATOR["show" if running else "run"], "smartphone", tooltip)


def host_blocker(state: HostShellState) -> str | None:
    """Why the local host daemon can't start the emulator for us, or None when it serves with a PIN set."""
    if state.status in ("stopped", "stopping", "failed"):
        return EMULATOR["host_stopped"]
    if state.status == "starting" or state.pairing is None:
        return EMULATOR["host_loading"]
    if not state.pairing.pin_set:
        return EMULATOR["host_no_pin"]
    return None


def _trim(url: str) -> str:
    return url.strip().rstrip("/").lower()


def is_linked_to(link: AndroidLinkInfo, sandbox_url: str) -> bool:
    return link["configured"] and link["sandboxUrl"] is not None and _trim(link["sandboxUrl"]) == _trim(sandbox_url)


def pick_avd(status: HostAndroidStatus) -> str | None:
    current = status["emulator"].get("avd")
    return current if current in status["avds"] else next(iter(status["avds"]), None)


def plan_emulator(status: HostAndroidStatus, sandbox_url: str) -> EmulatorPlan:
    if not status["available"] or status["emulator"]["state"] == "unavailable":
        return EmulatorPlan(blocked=status.get("reason") or EMULATOR["host_unavailable"])
    if status["isolation"] == "none":
        return EmulatorPlan(blocked=EMULATOR["isolation_off"])
    emulator, link = status["emulator"], status["link"]
    state = emulator["state"]
    if state == "stopping":
        return EmulatorPlan(blocked=EMULATOR["stopping"])
    linked = is_linked_to(link, sandbox_url)
    relink = not (linked and link["connected"])
    replaces = link["sandboxUrl"] if link["configured"] and link["connected"] and not linked else None
    usable = state in ("starting", "running") and emulator["isolated"]
    if usable:
        return EmulatorPlan(link=relink, replaces=replaces)
    avd = pick_avd(status)
    if avd is None:
        return EmulatorPlan(blocked=EMULATOR["no_avd"])
    return EmulatorPlan(stop=state in ("starting", "running"), avd=avd, link=relink, replaces=replaces)


def emulator_ready(status: HostAndroidStatus, sandbox_url: str) -> bool:
    emulator, link = status["emulator"], status["link"]
    return emulator["state"] == "running" and emulator["isolated"] and is_linked_to(link, sandbox_url) and link["connected"]


class EmulatorTimeout(RuntimeError):
    pass


def _wait(check: Callable[[], bool], timeout_s: float, message: str, sleep: Callable[[float], None], clock: Callable[[], float]) -> None:
    deadline = clock() + timeout_s
    while not check():
        if clock() >= deadline:
            raise EmulatorTimeout(message)
        sleep(POLL_S)


def _settled(host: HostAndroidClient, done: Callable[[HostAndroidStatus], bool]) -> Callable[[], bool]:
    def check() -> bool:
        status = host.status()
        if status["emulator"]["state"] == "failed" and not done(status):
            raise RuntimeError(EMULATOR["emulator_failed"].format(error=status["emulator"].get("error") or "unknown error"))
        return done(status)

    return check


def prepare_emulator(
    host: HostAndroidClient,
    client: ControllerClient,
    project_id: str,
    target: str,
    plan: EmulatorPlan,
    progress: Callable[[Stage], None],
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> None:
    """Runs `plan` on the host daemon and blocks until the sandbox offers `target`. Call it off the main thread."""
    if plan.stop:
        progress("stopping")
        host.stop_emulator()
        _wait(lambda: host.status()["emulator"]["state"] in ("stopped", "failed"), STOP_TIMEOUT_S, EMULATOR["stop_timeout"], sleep, clock)
    if plan.avd:
        progress("starting")
        host.start_emulator(plan.avd)
    if plan.link:
        progress("linking")
        host.link_sandbox(client.base_url, client.token)
    progress("booting")
    _wait(
        _settled(host, lambda status: emulator_ready(status, client.base_url)),
        BOOT_TIMEOUT_S,
        EMULATOR["boot_timeout"].format(minutes=round(BOOT_TIMEOUT_S / 60)),
        sleep,
        clock,
    )

    def offered() -> bool:
        found = android_target([item for item in client.list_run_targets(project_id) if item["target"] == target])
        return found is not None and found["available"]

    _wait(offered, TARGET_TIMEOUT_S, EMULATOR["target_timeout"].format(seconds=round(TARGET_TIMEOUT_S)), sleep, clock)


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
