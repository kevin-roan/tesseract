from collections.abc import Callable
from dataclasses import dataclass

from .theme.surfaces import SurfaceTone
from .theme.tone import Tone


@dataclass
class StatItem:
    id: str
    icon: str
    label: str
    value: str
    unit: str | None = None
    progress: float | None = None
    tone: SurfaceTone = "neutral"
    caption: str | None = None
    on_activate: Callable[[], None] | None = None


@dataclass(frozen=True)
class EmptyModel:
    title: str
    message: str | None = None
    icon: str | None = None
    loading: bool = False
    action_label: str | None = None
    action: str | None = None
    secondary_label: str | None = None
    secondary: str | None = None


@dataclass(frozen=True)
class NoticeModel:
    message: str
    title: str | None = None
    tone: Tone = "neutral"
    action_label: str | None = None
    action: str | None = None
