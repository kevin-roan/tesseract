from dataclasses import dataclass
from types import MappingProxyType

SPACING = MappingProxyType({
    "none": 0, "xxs": 2, "xs": 4, "sm": 8, "md": 12, "base": 16, "lg": 20, "xl": 24,
    "2xl": 32, "3xl": 40, "4xl": 48, "5xl": 64, "6xl": 80,
})

SCREEN_GUTTER = 32
SECTION_GAP = 32
MAX_CONTENT_WIDTH = 1120
SIDEBAR_WIDTH = 272
SIDEBAR_WIDTH_FRACTION = 0.24
SIDEBAR_WIDTH_RANGE = (220, 300)

DEFAULT_WINDOW_SIZE = (1240, 800)
MIN_WINDOW_SIZE = (360, 480)
COLLAPSE_BREAKPOINT = "max-width: 720sp"

WINDOW_CONTROL = MappingProxyType({
    "size": 28, "glyph": 10, "stroke": 1.25, "corner": 1.5, "restore_offset": 2, "spacing": 6,
})

COMPOSER_MAX_HEIGHT = 168
BASE_FONT_SIZE = 14
ZOOM_STEPS = (0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0)
SIDEBAR_RUN_INDENT = 30

RADIUS = MappingProxyType({
    "none": 0, "xs": 4, "sm": 8, "md": 12, "lg": 16, "xl": 20, "2xl": 28, "3xl": 32,
    "card": 22, "sheet": 36, "pill": 999, "full": 999,
})
SQUARE_CORNERS = MappingProxyType({"card": 20, "sheet": 28, "pill": 14})
CORNER_SHAPES = MappingProxyType({"light": "soft", "dark": "soft", "graphite": "square"})

DURATIONS = MappingProxyType({
    "instant": 0, "fastest": 80, "fast": 140, "normal": 220, "slow": 320, "slower": 480, "slowest": 720,
})
EASINGS = MappingProxyType({
    "standard": (0.2, 0, 0, 1),
    "decelerate": (0, 0, 0, 1),
    "accelerate": (0.3, 0, 1, 1),
    "emphasized": (0.2, 0, 0, 1),
    "overshoot": (0.34, 1.56, 0.64, 1),
    "linear": (0, 0, 1, 1),
})
PRESS_SCALE = MappingProxyType({"card": 0.98, "control": 0.95})
CHART_MOTION = MappingProxyType({
    "reveal": DURATIONS["slowest"] * 2,
    "pulse": DURATIONS["slowest"] * 4,
    "stream": DURATIONS["slowest"] * 20,
    "pulse_floor": 0.35,
})
SHIMMER_CYCLE = DURATIONS["slowest"] * 2

BORDER_WIDTH = MappingProxyType({"none": 0, "hairline": 0.5, "thin": 1, "thick": 2, "focus": 3})

CONTROL_HEIGHT = MappingProxyType({"sm": 32, "md": 40, "lg": 48, "xl": 56})
ICON_SIZE = MappingProxyType({"xs": 14, "sm": 16, "md": 20, "lg": 24, "xl": 32, "2xl": 48})
AVATAR_SIZE = MappingProxyType({"xs": 20, "sm": 28, "md": 36, "lg": 48, "xl": 72})


@dataclass(frozen=True)
class Shadow:
    offset_y: int
    blur: int
    opacity: float

    def css(self) -> str:
        return f"0 {self.offset_y}px {self.blur}px rgba(0, 0, 0, {self.opacity})"


SHADOWS = MappingProxyType({
    "none": None,
    "level1": Shadow(1, 6, 0.08),
    "level2": Shadow(4, 14, 0.12),
    "level3": Shadow(8, 24, 0.16),
    "level4": Shadow(14, 40, 0.22),
})


def spacing(token: str) -> int:
    return SPACING[token]


def radius(token: str) -> int:
    return RADIUS[token]


def radius_for(scheme: str) -> MappingProxyType:
    if CORNER_SHAPES.get(scheme) == "square":
        return MappingProxyType({**RADIUS, **SQUARE_CORNERS})
    return RADIUS


def easing(token: str) -> str:
    return "cubic-bezier({})".format(", ".join(f"{value:g}" for value in EASINGS[token]))


def transition(*properties: str, duration: str = "fast", curve: str = "standard") -> str:
    return ", ".join(f"{prop} {DURATIONS[duration]}ms {easing(curve)}" for prop in properties)
