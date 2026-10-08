from dataclasses import dataclass

from ..store import ConnectionState
from ..strings import BANNER, CONNECTION_LABELS, EVENTS_LABELS, STATUS_FOOTER
from ..theme.tone import Tone

CONNECTION_TONES: dict[str, Tone] = {
    "unconfigured": "neutral",
    "discovering": "info",
    "connecting": "info",
    "online": "success",
    "offline": "danger",
    "unauthorized": "warning",
    "incompatible": "warning",
}

EVENT_TONES: dict[str, Tone] = {
    "open": "success",
    "connecting": "info",
    "idle": "neutral",
    "closed": "neutral",
    "unavailable": "neutral",
    "incompatible": "warning",
}

BANNER_ACTIONS = {
    "unconfigured": "preferences",
    "offline": "retry",
    "unauthorized": "preferences",
    "incompatible": "preferences",
}


@dataclass(frozen=True)
class BannerModel:
    visible: bool
    title: str = ""
    button_label: str | None = None
    action: str | None = None


def banner_for(state: ConnectionState) -> BannerModel:
    template = BANNER.get(state.status)
    if template is None:
        return BannerModel(False)
    title, button = template
    return BannerModel(
        True,
        title.format(error=state.error_message or ""),
        button,
        BANNER_ACTIONS.get(state.status),
    )


def connection_tone(state: ConnectionState) -> Tone:
    return CONNECTION_TONES[state.status]


def connection_label(state: ConnectionState, with_name: bool = True) -> str:
    name = state.sandbox_name if with_name else None
    label = CONNECTION_LABELS[state.status]
    return f"{name} · {label}" if name else label


def status_title(state: ConnectionState) -> str:
    return state.sandbox_name or STATUS_FOOTER["fallback_title"]


def events_tone(status: str) -> Tone:
    return EVENT_TONES.get(status, "neutral")


def events_label(status: str) -> str:
    return EVENTS_LABELS.get(status, status)
