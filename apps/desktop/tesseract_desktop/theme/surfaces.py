from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Literal

from . import palette as P
from .semantic import SchemeName

SurfaceTone = Literal["neutral", "violet", "indigo", "yellow"]
SURFACE_TONES: tuple[SurfaceTone, ...] = ("neutral", "violet", "indigo", "yellow")


@dataclass(frozen=True)
class SurfaceFill:
    inner: str
    outer: str
    cx: float
    cy: float
    r: float


@dataclass(frozen=True)
class SurfaceStyle:
    fill: SurfaceFill
    border: str
    ink: MappingProxyType = field(default_factory=lambda: MappingProxyType({}))


ON_DARK = MappingProxyType({
    "text": P.WHITE,
    "textSecondary": "rgba(255, 255, 255, 0.78)",
    "textTertiary": "rgba(255, 255, 255, 0.62)",
    "border": "rgba(255, 255, 255, 0.18)",
    "divider": "rgba(255, 255, 255, 0.12)",
    "surfaceElevated": "rgba(255, 255, 255, 0.14)",
    "backgroundElement": "rgba(255, 255, 255, 0.12)",
    "backgroundSelected": "rgba(255, 255, 255, 0.22)",
    "highlight": P.YELLOW[400],
})

ON_YELLOW = MappingProxyType({
    "text": P.GRAY[950],
    "textSecondary": "rgba(20, 20, 22, 0.72)",
    "textTertiary": "rgba(20, 20, 22, 0.6)",
    "border": "rgba(20, 20, 22, 0.14)",
    "divider": "rgba(20, 20, 22, 0.1)",
    "surfaceElevated": "rgba(20, 20, 22, 0.08)",
    "backgroundElement": "rgba(20, 20, 22, 0.08)",
    "backgroundSelected": "rgba(20, 20, 22, 0.14)",
    "highlight": P.GRAY[950],
})

GRAPHITE_BORDER = "rgba(255, 255, 255, 0.08)"
GRAPHITE_LIGHT_BORDER = "rgba(0, 0, 0, 0.09)"


def _on_dark_tint(highlight: str) -> MappingProxyType:
    return MappingProxyType({
        "surfaceElevated": "rgba(255, 255, 255, 0.06)",
        "backgroundElement": "rgba(255, 255, 255, 0.06)",
        "backgroundSelected": "rgba(255, 255, 255, 0.12)",
        "highlight": highlight,
    })


def _graphite_tone(highlight: str) -> SurfaceStyle:
    flat = P.GRAPHITE[900]
    return SurfaceStyle(SurfaceFill(flat, flat, 0.5, 0, 1), GRAPHITE_BORDER, _on_dark_tint(highlight))


def _graphite_light_tone(highlight: str) -> SurfaceStyle:
    flat = P.LINEAR_LIGHT["panel"]
    return SurfaceStyle(SurfaceFill(flat, flat, 0.5, 0, 1), GRAPHITE_LIGHT_BORDER, MappingProxyType({
        "surfaceElevated": "rgba(0, 0, 0, 0.03)",
        "backgroundElement": "rgba(0, 0, 0, 0.04)",
        "backgroundSelected": "rgba(0, 0, 0, 0.08)",
        "highlight": highlight,
    }))


_VIOLET = SurfaceStyle(SurfaceFill(P.PLUM[300], P.PLUM[700], 0.15, 0.1, 1), "rgba(255, 255, 255, 0.12)", ON_DARK)
_INDIGO = SurfaceStyle(SurfaceFill(P.NAVY[950], P.NAVY[500], 0.5, 0.55, 0.62), "rgba(255, 255, 255, 0.1)", ON_DARK)
_YELLOW = SurfaceStyle(SurfaceFill(P.YELLOW[300], P.YELLOW[500], 0.3, 0.2, 0.9), "rgba(20, 20, 22, 0.06)", ON_YELLOW)

SURFACES = MappingProxyType({
    "light": MappingProxyType({
        "neutral": SurfaceStyle(SurfaceFill(P.WHITE, P.GRAY[25], 0.2, 0.1, 1), P.GRAY[200]),
        "violet": _VIOLET,
        "indigo": _INDIGO,
        "yellow": _YELLOW,
    }),
    "dark": MappingProxyType({
        "neutral": SurfaceStyle(SurfaceFill("#303034", "#19191B", 0.2, 0.12, 0.95), "rgba(255, 255, 255, 0.06)"),
        "violet": _VIOLET,
        "indigo": _INDIGO,
        "yellow": _YELLOW,
    }),
    "graphite": MappingProxyType({
        "neutral": _graphite_tone(P.GRAPHITE[100]),
        "violet": _graphite_tone(P.LINEAR["purple"]),
        "indigo": _graphite_tone(P.LINEAR["indigoInk"]),
        "yellow": _graphite_tone(P.LINEAR["yellow"]),
    }),
    "graphiteLight": MappingProxyType({
        "neutral": _graphite_light_tone(P.LINEAR_LIGHT["text"]),
        "violet": _graphite_light_tone(P.LINEAR_LIGHT["purple"]),
        "indigo": _graphite_light_tone(P.LINEAR_LIGHT["indigoInk"]),
        "yellow": _graphite_light_tone(P.LINEAR_LIGHT["yellow"]),
    }),
})


def surfaces_for(scheme: SchemeName) -> MappingProxyType:
    return SURFACES[scheme]
