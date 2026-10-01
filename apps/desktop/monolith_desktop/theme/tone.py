from dataclasses import dataclass
from types import MappingProxyType
from typing import Literal

Tone = Literal["neutral", "info", "success", "warning", "danger"]
TONES: tuple[Tone, ...] = ("neutral", "info", "success", "warning", "danger")


@dataclass(frozen=True)
class ToneColor:
    foreground: str
    background: str
    solid: str


TONE_COLORS = MappingProxyType({
    "neutral": ToneColor("textSecondary", "backgroundElement", "textTertiary"),
    "info": ToneColor("info", "infoMuted", "infoSolid"),
    "success": ToneColor("success", "successMuted", "successSolid"),
    "warning": ToneColor("warning", "warningMuted", "warningSolid"),
    "danger": ToneColor("danger", "dangerMuted", "dangerSolid"),
})
