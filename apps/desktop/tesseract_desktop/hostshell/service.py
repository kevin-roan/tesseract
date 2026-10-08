import json
import logging
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
from collections.abc import Callable, Mapping
from dataclasses import replace

from gi.repository import GLib

from ..api import types as T
from ..api.tasks import Task, call_on_main, run_async
from ..config.storage import read_settings, write_settings
from ..store import Observable
from .android import HostAndroidClient, session_expiry
from .stream import StreamState, parse_stream
from .model import (
    LISTENING_MARKER,
    HostPairing,
    HostShellError,
    HostShellState,
    append_log,
    cli_error,
    controller_command,
    health_url,
    host_token,
    is_host_health,
    parse_pairing,
)

log = logging.getLogger(__name__)

AUTOSTART_SETTING = "host_shell_autostart"
CLI_TIMEOUT_S = 30
HEALTH_TIMEOUT_S = 1.5
STOP_GRACE_S = 5
SHUTDOWN_WAIT_S = 3
SESSION_MARGIN_S = 30


class HostShellService:
    """Runs `tesseract-controller host serve` as a child of the app and wraps `host pin|pair|token` for the UI."""

    def __init__(self, env: Mapping[str, str] | None = None) -> None:
        self._env = dict(os.environ if env is None else env)
        self.state: Observable[HostShellState] = Observable(HostShellState(autostart=self._read_autostart()))
        self._process: subprocess.Popen[str] | None = None
        self._stopping = False
        self._session: tuple[str, float] | None = None

    def start_if_enabled(self) -> None:
        if self.state.value.autostart:
            self.start()
        else:
            self.refresh()

    def set_autostart(self, enabled: bool) -> None:
        settings = read_settings()
        settings[AUTOSTART_SETTING] = enabled
        try:
            write_settings(settings)
        except OSError:
            log.warning("could not save the host shell autostart setting", exc_info=True)
        self._update(autostart=enabled)

    def refresh(self) -> Task[tuple[HostPairing, bool]]:
        owned = self.state.value.owned
        return run_async(lambda: self._probe(owned), on_success=self._on_probe, on_error=self._on_probe_error)

    def start(self) -> None:
        current = self.state.value
        if current.owned or current.status == "external":
            return
        try:
            command = controller_command(self._env)
            process = subprocess.Popen(
                self._supervised([*command, "host", "serve"]),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                env=self._env,
            )
        except (HostShellError, OSError) as error:
            self._update(status="failed", error=str(error))
            return
        self._process = process
        self._stopping = False
        self.state.set(replace(self.state.value, status="starting", error=None, log=()))
        threading.Thread(target=self._pump, args=(process,), name="host-shell", daemon=True).start()

    def stop(self) -> None:
        process = self._process
        if process is None:
            return
        self._stopping = True
        self._update(status="stopping")
        process.terminate()
        GLib.timeout_add_seconds(STOP_GRACE_S, self._kill_if_alive, process)

    def set_pin(self, pin: str, on_success: Callable[[], None], on_error: Callable[[BaseException], None]) -> Task[str]:
        return run_async(
            lambda: self._cli(["pin", "--stdin"], stdin=f"{pin}\n"),
            on_success=lambda _out: (on_success(), self.refresh()),
            on_error=on_error,
        )

    def rotate_token(self, on_success: Callable[[], None], on_error: Callable[[BaseException], None]) -> Task[str]:
        return run_async(
            lambda: self._cli(["token", "--rotate"]),
            on_success=lambda _out: (on_success(), self.refresh()),
            on_error=on_error,
        )

    def stream(self, on_success: Callable[[StreamState], None], on_error: Callable[[BaseException], None]) -> Task[StreamState]:
        """The Android stream settings in the host state file and the adb devices; works while the daemon is stopped."""
        return run_async(lambda: parse_stream(self._cli(["stream", "--json"])), on_success=on_success, on_error=on_error)

    def update_stream(
        self, change: dict, on_success: Callable[[StreamState], None], on_error: Callable[[BaseException], None]
    ) -> Task[StreamState]:
        return run_async(
            lambda: parse_stream(self._cli(["stream", "--json", "--stdin"], stdin=json.dumps(change))),
            on_success=on_success,
            on_error=on_error,
        )

    def android_client(self) -> HostAndroidClient | None:
        """A client for the host's Android API while the daemon serves and a PIN session is live."""
        state = self.state.value
        if not state.ready or state.pairing is None or self._session is None:
            return None
        session, expires = self._session
        if expires - SESSION_MARGIN_S <= time.time():
            self._session = None
            return None
        return HostAndroidClient(state.pairing.url, session)

    def unlock(self, pin: str, on_success: Callable[[], None], on_error: Callable[[BaseException], None]) -> Task[T.HostSession]:
        pairing = self.state.value.pairing

        def work() -> T.HostSession:
            if pairing is None:
                raise HostShellError("The host shell is not running")
            return HostAndroidClient(pairing.url, host_token(pairing.link)).unlock(pin)

        def unlocked(session: T.HostSession) -> None:
            self._session = (session["session"], session_expiry(session))
            on_success()

        return run_async(work, on_success=unlocked, on_error=on_error)

    def forget_session(self) -> None:
        self._session = None

    def shutdown(self) -> None:
        process, self._process = self._process, None
        if process is None or process.poll() is not None:
            return
        process.terminate()
        try:
            process.wait(SHUTDOWN_WAIT_S)
        except subprocess.TimeoutExpired:
            process.kill()

    def _read_autostart(self) -> bool:
        return read_settings().get(AUTOSTART_SETTING) is True

    def _update(self, **changes) -> None:
        self.state.set(replace(self.state.value, **changes))

    def _supervised(self, command: list[str]) -> list[str]:
        """Linux: the daemon gets SIGTERM if the app dies without a clean shutdown."""
        setpriv = shutil.which("setpriv", path=self._env.get("PATH")) if sys.platform.startswith("linux") else None
        return [setpriv, "--pdeathsig", "TERM", "--", *command] if setpriv else command

    def _cli(self, args: list[str], stdin: str | None = None) -> str:
        command = controller_command(self._env)
        try:
            result = subprocess.run(
                [*command, "host", *args],
                input=stdin,
                capture_output=True,
                text=True,
                timeout=CLI_TIMEOUT_S,
                env=self._env,
            )
        except subprocess.TimeoutExpired as error:
            raise HostShellError("The controller did not answer in time") from error
        except OSError as error:
            raise HostShellError(str(error)) from error
        if result.returncode != 0:
            raise HostShellError(cli_error(f"{result.stdout}\n{result.stderr}", result.returncode))
        return result.stdout

    def _probe(self, owned: bool) -> tuple[HostPairing, bool]:
        pairing = parse_pairing(self._cli(["pair", "--json"]))
        return pairing, (not owned and self._answers(pairing.url))

    def _answers(self, base_url: str) -> bool:
        try:
            with urllib.request.urlopen(health_url(base_url), timeout=HEALTH_TIMEOUT_S) as response:
                return is_host_health(json.loads(response.read().decode("utf-8")))
        except (OSError, ValueError):
            return False

    def _on_probe(self, result: tuple[HostPairing, bool]) -> None:
        pairing, external = result
        current = self.state.value
        if current.owned:
            self._update(pairing=pairing)
        elif external:
            self._update(pairing=pairing, status="external", error=None)
        elif current.status == "external":
            self._update(pairing=pairing, status="stopped")
        else:
            self._update(pairing=pairing, error=current.error if current.status == "failed" else None)

    def _on_probe_error(self, error: BaseException) -> None:
        current = self.state.value
        self._update(error=str(error), status="failed" if not current.owned else current.status)

    def _pump(self, process: subprocess.Popen[str]) -> None:
        assert process.stdout is not None
        for line in process.stdout:
            call_on_main(self._on_line, process, line.rstrip())
        call_on_main(self._on_exit, process, process.wait())

    def _on_line(self, process: subprocess.Popen[str], line: str) -> None:
        if process is not self._process:
            return
        current = self.state.value
        self.state.set(replace(current, log=append_log(current.log, line)))
        if LISTENING_MARKER in line and current.status == "starting":
            self._update(status="running")
            self.refresh()

    def _on_exit(self, process: subprocess.Popen[str], code: int) -> None:
        if process is not self._process:
            return
        self._process = None
        if self._stopping or code == 0:
            self._update(status="stopped", error=None)
        else:
            self._update(status="failed", error=cli_error("\n".join(self.state.value.log), code))

    def _kill_if_alive(self, process: subprocess.Popen[str]) -> bool:
        if process.poll() is None:
            process.kill()
        return GLib.SOURCE_REMOVE
