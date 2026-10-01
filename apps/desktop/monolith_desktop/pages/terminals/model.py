from dataclasses import dataclass
from typing import Any, Literal

from ...api.types import Project, TerminalInfo
from ...theme.tone import Tone
from ...util.format import format_relative_time, join_meta
from .labels import BANNER, KIND_ICONS, KINDS, META, STATES, WORKSPACE

SessionState = Literal["connecting", "open", "reconnecting", "exited", "closed", "unavailable"]
TERMINAL_KINDS = ("shell", "claude")

STATE_TONES: dict[str, Tone] = {
    "connecting": "info",
    "open": "success",
    "reconnecting": "warning",
    "exited": "neutral",
    "closed": "danger",
    "unavailable": "danger",
}


@dataclass(frozen=True)
class AttachRequest:
    terminal_id: str


@dataclass(frozen=True)
class LaunchRequest:
    kind: str
    project_id: str | None = None


@dataclass(frozen=True)
class RowModel:
    id: str
    icon: str
    title: str
    subtitle: str
    status: str
    tone: Tone
    running: bool


@dataclass(frozen=True)
class BannerModel:
    title: str
    message: str
    tone: Tone
    action: str | None
    secondary: str | None = None


def parse_open(params: dict[str, Any] | None) -> AttachRequest | LaunchRequest | None:
    if not params:
        return None
    terminal_id = params.get("terminalId")
    if isinstance(terminal_id, str) and terminal_id:
        return AttachRequest(terminal_id)
    kind = params.get("kind")
    if kind in TERMINAL_KINDS:
        project_id = params.get("projectId")
        return LaunchRequest(kind, project_id if isinstance(project_id, str) and project_id else None)
    return None


def sort_sessions(terminals: list[TerminalInfo] | None) -> list[TerminalInfo]:
    items = list(terminals or [])
    items.sort(key=lambda t: t.get("createdAt") or "", reverse=True)
    items.sort(key=lambda t: 0 if t.get("state") == "running" else 1)
    return items


def kind_label(kind: str) -> str:
    return KINDS.get(kind, kind.title())


def kind_icon(kind: str) -> str:
    return KIND_ICONS.get(kind, "terminal")


def project_label(project_id: str | None, projects: list[Project] | None) -> str:
    if not project_id:
        return WORKSPACE
    project = next((p for p in projects or [] if p.get("id") == project_id), None)
    return (project.get("name") if project else None) or project_id


def session_title(info: TerminalInfo, projects: list[Project] | None) -> str:
    return f"{kind_label(info['kind'])} · {project_label(info.get('projectId'), projects)}"


def session_subtitle(info: TerminalInfo, now: float | None = None) -> str:
    when = format_relative_time(info.get("createdAt"), now)
    running = info.get("state") == "running" and info.get("cols") and info.get("rows")
    return join_meta(
        META["started"].format(when=when) if when else None,
        META["size"].format(cols=info.get("cols"), rows=info.get("rows")) if running else None,
    )


def info_status(info: TerminalInfo) -> tuple[str, Tone]:
    if info.get("state") == "exited":
        return exit_label(info.get("exitCode")), "neutral"
    return STATES["running"], "success"


def exit_label(code: int | None) -> str:
    return STATES["exited"] if code is None else STATES["exited_code"].format(code=code)


def row_model(info: TerminalInfo, projects: list[Project] | None, now: float | None = None) -> RowModel:
    status, tone = info_status(info)
    return RowModel(
        info["id"],
        kind_icon(info["kind"]),
        session_title(info, projects),
        session_subtitle(info, now),
        status,
        tone,
        info.get("state") == "running",
    )


def state_badge(state: SessionState, exit_code: int | None = None) -> tuple[str, Tone]:
    if state == "exited":
        return exit_label(exit_code), STATE_TONES[state]
    return STATES[state], STATE_TONES[state]


def banner(state: SessionState, exit_code: int | None = None, error: str | None = None) -> BannerModel | None:
    if state == "exited":
        message = BANNER["exited_unknown"] if exit_code is None else BANNER["exited"].format(code=exit_code)
        return BannerModel(BANNER["exited_title"], message, "danger" if exit_code else "neutral", "restart", "remove")
    if state == "closed":
        return BannerModel(BANNER["closed_title"], BANNER["closed"].format(error=error or "").strip(), "danger", "reconnect")
    if state == "reconnecting":
        return BannerModel(BANNER["reconnecting_title"], BANNER["reconnecting"], "warning", None)
    return None


def merge_info(existing: TerminalInfo | None, terminal_id: str) -> TerminalInfo:
    if existing is not None:
        return existing
    return {
        "id": terminal_id, "kind": "shell", "projectId": None, "title": "", "cwd": "", "pid": None,
        "cols": 0, "rows": 0, "state": "running", "exitCode": None, "createdAt": "",
    }
