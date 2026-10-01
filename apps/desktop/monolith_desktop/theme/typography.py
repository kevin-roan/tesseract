from dataclasses import dataclass
from types import MappingProxyType

FONT_WEIGHTS = MappingProxyType({"regular": 400, "medium": 500, "semibold": 600, "bold": 700})
LETTER_SPACING = MappingProxyType({"tighter": -0.6, "tight": -0.3, "normal": 0, "wide": 0.4, "wider": 1.2})

SANS_STACK = ("Saira", "Inter", "Adwaita Sans", "Cantarell", "sans-serif")
MONO_STACK = ("JetBrains Mono", "Adwaita Mono", "Source Code Pro", "DejaVu Sans Mono", "monospace")
SERIF_STACK = ("serif",)


@dataclass(frozen=True)
class TextVariant:
    size: int
    line_height: int
    weight: int
    letter_spacing: float = 0.0
    uppercase: bool = False
    mono: bool = False


TEXT_VARIANTS = MappingProxyType({
    "display": TextVariant(48, 52, FONT_WEIGHTS["semibold"], LETTER_SPACING["tighter"]),
    "h1": TextVariant(32, 40, FONT_WEIGHTS["semibold"], LETTER_SPACING["tight"]),
    "h2": TextVariant(24, 32, FONT_WEIGHTS["semibold"], LETTER_SPACING["tight"]),
    "h3": TextVariant(20, 28, FONT_WEIGHTS["semibold"]),
    "h4": TextVariant(17, 24, FONT_WEIGHTS["semibold"]),
    "bodyLarge": TextVariant(18, 28, FONT_WEIGHTS["regular"]),
    "body": TextVariant(16, 24, FONT_WEIGHTS["regular"]),
    "bodyStrong": TextVariant(16, 24, FONT_WEIGHTS["semibold"]),
    "bodySmall": TextVariant(14, 20, FONT_WEIGHTS["regular"]),
    "label": TextVariant(14, 20, FONT_WEIGHTS["medium"]),
    "button": TextVariant(16, 20, FONT_WEIGHTS["semibold"]),
    "caption": TextVariant(12, 16, FONT_WEIGHTS["regular"]),
    "overline": TextVariant(11, 16, FONT_WEIGHTS["semibold"], LETTER_SPACING["wider"], uppercase=True),
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
