from dataclasses import dataclass
from types import MappingProxyType

FONT_WEIGHTS = MappingProxyType({"regular": 400, "medium": 500, "semibold": 600, "bold": 700, "extrabold": 800})
LETTER_SPACING = MappingProxyType({
    "tightest": -1.2, "tighter": -0.8, "tight": -0.4, "snug": -0.2, "normal": 0, "wide": 0.4, "wider": 1.0,
})

SANS_STACK = ("Noto Sans", "Inter", "Adwaita Sans", "Cantarell", "sans-serif")
DISPLAY_STACK = ("Exo 2", "Noto Sans", "Inter", "Adwaita Sans", "Cantarell", "sans-serif")
MONO_STACK = ("Geist Mono", "JetBrains Mono", "Adwaita Mono", "Source Code Pro", "DejaVu Sans Mono", "monospace")
SERIF_STACK = ("serif",)


@dataclass(frozen=True)
class TextVariant:
    size: int
    line_height: int
    weight: int
    letter_spacing: float = 0.0
    uppercase: bool = False
    mono: bool = False
    display: bool = False
    tabular: bool = False


def _display(size: int, line_height: int, weight: str, spacing: str = "normal", **flags: bool) -> TextVariant:
    return TextVariant(size, line_height, FONT_WEIGHTS[weight], LETTER_SPACING[spacing], display=True, **flags)


TEXT_VARIANTS = MappingProxyType({
    "display": _display(48, 54, "semibold", "tightest"),
    "title": _display(34, 40, "medium", "tighter"),
    "greeting": _display(30, 36, "regular", "tight"),
    "h1": _display(32, 38, "semibold", "tighter"),
    "h2": _display(24, 30, "semibold", "tight"),
    "h3": _display(20, 26, "semibold", "snug"),
    "h4": _display(17, 22, "semibold", "snug"),
    "metric": _display(44, 48, "bold", "tightest", tabular=True),
    "metricSmall": _display(28, 32, "semibold", "tighter", tabular=True),
    "bodyLarge": TextVariant(18, 26, FONT_WEIGHTS["regular"]),
    "body": TextVariant(16, 24, FONT_WEIGHTS["regular"]),
    "bodyStrong": TextVariant(16, 24, FONT_WEIGHTS["semibold"]),
    "bodySmall": TextVariant(14, 20, FONT_WEIGHTS["regular"]),
    "label": TextVariant(14, 20, FONT_WEIGHTS["medium"]),
    "button": _display(16, 20, "semibold"),
    "caption": TextVariant(12, 16, FONT_WEIGHTS["regular"]),
    "overline": _display(11, 16, "semibold", "wider", uppercase=True),
    "code": TextVariant(13, 20, FONT_WEIGHTS["regular"], mono=True),
})

DESKTOP_FONT_SCALE = 0.9


def font_stack(families: tuple[str, ...]) -> str:
    return ", ".join(f'"{f}"' if " " in f else f for f in families)


def installed_first(families: tuple[str, ...], installed: set[str]) -> tuple[str, ...]:
    if not installed:
        return families
    lowered = {name.lower() for name in installed}
    present = tuple(f for f in families if f.lower() in lowered)
    generic = tuple(f for f in families if f in ("sans-serif", "serif", "monospace"))
    return present + tuple(f for f in generic if f not in present) or families
