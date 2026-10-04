from dataclasses import dataclass
from typing import Literal

from gi.repository import Gdk

from ...api.types import DisplayStatus
from ...store import ConnectionState
from ...theme.tone import Tone
from ...viewmodels import EmptyModel
from ...vnc.session import SessionState, display_ready
from .labels import BADGES, EMPTY, META, OVERLAY, PREVIEW

Mode = Literal["offline", "loading", "error", "no_display", "preview", "viewer"]

STATUS_INTERVAL_S = 5.0
SCREENSHOT_INTERVAL_S = 3.0
FULLSCREEN_KEY = Gdk.KEY_F11
EXIT_KEYS = (Gdk.KEY_F11, Gdk.KEY_Escape)
VIEW_ONLY_ICON = "view-only"
EXIT_FULLSCREEN_ICON = "exit-fullscreen"
OVERFLOW_ICON = "more"
CLIPBOARD_ICON = "paste"
PNG_MIME = "image/png"
COMPACT_CONDITION = "max-width: 540sp"
MIN_SIZE = (300, 280)

ACTION_GROUP = "display"
ACTION_NAMES = {
    "view_only": "view-only",
    "clipboard": "clipboard",
    "keys": "keys",
    "screenshot": "screenshot",
    "browser": "browser",
    "reconnect": "reconnect",
    "fullscreen": "fullscreen",
}
TICK_S = 1

EMPTY_ICONS = {"offline": "offline", "error": "warning", "no_display": "display"}
MODE_TONES: dict[str, Tone] = {
    "offline": "danger",
    "loading": "info",
    "error": "danger",
    "no_display": "neutral",
    "preview": "warning",
}
PHASE_TONES: dict[str, Tone] = {
    "idle": "neutral",
    "connecting": "info",
    "authenticating": "info",
    "connected": "success",
    "retrying": "warning",
    "auth_failed": "danger",
    "unavailable": "warning",
    "failed": "danger",
}
BUSY_PHASES = ("idle", "connecting", "authenticating")
VIEWER_ACTIONS = frozenset({"scale", "view_only", "clipboard", "keys", "fullscreen"})
LIVE_ACTIONS = frozenset({"keys"})
STATUS_ACTIONS = frozenset({"screenshot", "browser", "reconnect"})


@dataclass(frozen=True)
class OverlayModel:
    title: str
    message: str | None
    loading: bool
    action_label: str | None


def mode_for(connection: ConnectionState, status: DisplayStatus | None, error: str | None) -> Mode:
    if not connection.online:
        return "offline"
    if status is None:
        return "error" if error else "loading"
    if display_ready(status):
        return "viewer"
    return "preview" if status.get("available") else "no_display"


def badge(mode: Mode, session: SessionState) -> tuple[str, Tone]:
    if mode == "viewer":
        return BADGES[session.phase], PHASE_TONES[session.phase]
    return BADGES[mode], MODE_TONES[mode]


def empty_model(mode: Mode, connection: ConnectionState, status: DisplayStatus | None, error: str | None) -> EmptyModel | None:
    template = EMPTY.get(mode)
    if template is None:
        return None
    title, message, action = template
    detail = error if mode == "error" else connection.error_message
    display = (status or {}).get("display") or ":1"
    return EmptyModel(
        title,
        message.format(error=detail or "", display=display),
        EMPTY_ICONS.get(mode),
        mode == "loading",
        action,
        "retry" if action else None,
    )


def overlay_model(session: SessionState, now: float) -> OverlayModel | None:
    template = OVERLAY.get(session.phase)
    if template is None:
        return None
    title, message, action = template
    reason = f"{session.error.rstrip('.')}. " if session.error else ""
    seconds = max(0, round((session.retry_at or now) - now))
    text = message.format(error=reason, seconds=seconds, attempt=session.attempt).strip() if message else ""
    return OverlayModel(title, text or None, session.phase in BUSY_PHASES, action)


def resolution(width: int, height: int) -> str | None:
    return META["resolution"].format(width=width, height=height) if width and height else None


def meta_text(mode: Mode, session: SessionState, status: DisplayStatus | None, scale: float | None) -> str:
    if mode not in ("viewer", "preview"):
        return ""
    width = session.width if mode == "viewer" and session.width else (status or {}).get("width") or 0
    height = session.height if mode == "viewer" and session.height else (status or {}).get("height") or 0
    parts = [resolution(width, height)]
    if mode == "viewer" and session.connected and scale:
        parts.append(META["scale"].format(percent=round(scale * 100)))
    if mode == "viewer" and session.name:
        parts.append(session.name)
    return " · ".join(part for part in parts if part)


def enabled_actions(mode: Mode, session: SessionState) -> frozenset[str]:
    if mode == "offline":
        return frozenset()
    if mode not in ("viewer", "preview"):
        return frozenset({"reconnect"})
    if mode == "preview":
        return STATUS_ACTIONS
    live = LIVE_ACTIONS if session.connected else frozenset()
    return STATUS_ACTIONS | (VIEWER_ACTIONS - LIVE_ACTIONS) | live


def preview_message() -> str:
    return PREVIEW["message"].format(seconds=round(SCREENSHOT_INTERVAL_S))
