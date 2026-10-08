import json
import os
import re
import shlex
import shutil
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from ..pairing import parse_params
from ..paths import PACKAGE_DIR

REPO_ROOT = PACKAGE_DIR.parents[2]
CONTROLLER_ENTRY = Path("apps") / "controller" / "src" / "index.ts"
ENV_CONTROLLER_COMMAND = "TESSERACT_CONTROLLER_COMMAND"
HEALTH_PATH = "/v1/health"
HOST_SHELL_SERVICE = "host-shell"
LISTENING_MARKER = "host shell listening"
PIN_PATTERN = re.compile(r"[0-9]{6,12}")
LOG_LIMIT = 200
_ERROR_PREFIX = re.compile(r"^error:\s*", re.I)

HostShellStatus = Literal["stopped", "starting", "running", "stopping", "external", "failed"]


class HostShellError(RuntimeError):
    pass


@dataclass(frozen=True)
class HostPairing:
    link: str
    url: str
    name: str
    pin_set: bool


@dataclass(frozen=True)
class HostShellState:
    status: HostShellStatus = "stopped"
    pairing: HostPairing | None = None
    error: str | None = None
    log: tuple[str, ...] = ()
    autostart: bool = False

    @property
    def serving(self) -> bool:
        return self.status in ("running", "external")

    @property
    def owned(self) -> bool:
        return self.status in ("starting", "running", "stopping")

    @property
    def ready(self) -> bool:
        return self.serving and self.pairing is not None and self.pairing.pin_set


def _find_bun(env: Mapping[str, str]) -> str | None:
    found = shutil.which("bun", path=env.get("PATH"))
    if found:
        return found
    home = env.get("BUN_INSTALL") or str(Path(env.get("HOME") or Path.home()) / ".bun")
    candidate = Path(home) / "bin" / "bun"
    return str(candidate) if os.access(candidate, os.X_OK) else None


def controller_command(env: Mapping[str, str] = os.environ, repo_root: Path = REPO_ROOT) -> list[str]:
    """`bun apps/controller/src/index.ts` from this checkout, or TESSERACT_CONTROLLER_COMMAND."""
    override = env.get(ENV_CONTROLLER_COMMAND, "").strip()
    if override:
        return shlex.split(override)
    entry = repo_root / CONTROLLER_ENTRY
    if not entry.is_file():
        raise HostShellError(f"The controller is not in this checkout ({entry}); set {ENV_CONTROLLER_COMMAND}")
    bun = _find_bun(env)
    if bun is None:
        raise HostShellError("Bun is not installed or not on PATH; install it from bun.sh")
    return [bun, str(entry)]


def parse_pairing(stdout: str) -> HostPairing:
    line = next((line for line in reversed(stdout.splitlines()) if line.strip().startswith("{")), "")
    try:
        data = json.loads(line)
    except ValueError as error:
        raise HostShellError("The controller printed no pairing link") from error
    if not isinstance(data, dict) or not isinstance(data.get("link"), str) or not isinstance(data.get("url"), str):
        raise HostShellError("The controller printed no pairing link")
    return HostPairing(
        link=data["link"],
        url=data["url"],
        name=str(data.get("name") or ""),
        pin_set=data.get("pinSet") is True,
    )


def host_token(link: str) -> str:
    """The host token carried by the `tesseract://host?…` pairing link."""
    token = parse_params(link.partition("?")[2].partition("#")[0]).get("token")
    if not token:
        raise HostShellError("The host pairing link has no token")
    return token


def cli_error(output: str, code: int | None = None) -> str:
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    flagged = [line for line in lines if _ERROR_PREFIX.match(line)]
    message = (flagged or lines or [""])[-1]
    message = _ERROR_PREFIX.sub("", message)
    if message:
        return message
    return f"The controller exited with code {code}" if code is not None else "The controller failed"


def pin_error(pin: str, repeat: str) -> str | None:
    if not PIN_PATTERN.fullmatch(pin):
        return "pin"
    if pin != repeat:
        return "repeat"
    return None


def health_url(base_url: str) -> str:
    return base_url.rstrip("/") + HEALTH_PATH


def is_host_health(body: object) -> bool:
    return isinstance(body, dict) and body.get("ok") is True and body.get("service") == HOST_SHELL_SERVICE


def append_log(log: tuple[str, ...], line: str, limit: int = LOG_LIMIT) -> tuple[str, ...]:
    return (*log, line)[-limit:]
