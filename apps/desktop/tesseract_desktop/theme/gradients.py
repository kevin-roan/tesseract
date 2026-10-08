from dataclasses import dataclass
from types import MappingProxyType

from . import palette as P
from .semantic import SchemeName


@dataclass(frozen=True)
class Gradient:
    colors: tuple[str, ...]
    locations: tuple[float, ...]
    start: tuple[float, float]
    end: tuple[float, float]


VERTICAL = ((0.5, 0.0), (0.5, 1.0))
HORIZONTAL = ((0.0, 0.5), (1.0, 0.5))

GRADIENTS = MappingProxyType({
    "light": MappingProxyType({
        "brand": Gradient((P.PERIWINKLE[300], P.PERIWINKLE[500], P.PERIWINKLE[600]), (0, 0.55, 1), *HORIZONTAL),
        "scrim": Gradient(("rgba(252, 252, 251, 0)", "rgba(252, 252, 251, 0.85)", P.CANVAS), (0, 0.6, 1), *VERTICAL),
    }),
    "dark": MappingProxyType({
        "brand": Gradient((P.PERIWINKLE[400], P.PERIWINKLE[500], P.PERIWINKLE[600]), (0, 0.55, 1), *HORIZONTAL),
        "scrim": Gradient(("rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.85)", P.BLACK), (0, 0.6, 1), *VERTICAL),
    }),
    "graphite": MappingProxyType({
        "brand": Gradient((P.LINEAR["indigo"], P.LINEAR["indigo"]), (0, 1), *HORIZONTAL),
        "scrim": Gradient(("rgba(9, 9, 10, 0)", "rgba(9, 9, 10, 0.85)", P.GRAPHITE[950]), (0, 0.6, 1), *VERTICAL),
        "wash": Gradient((P.GRAPHITE[950], P.GRAPHITE[950], P.GRAPHITE[950]), (0, 0.45, 1), *VERTICAL),
    }),
    "graphiteLight": MappingProxyType({
        "brand": Gradient((P.LINEAR["indigo"], P.LINEAR["indigo"]), (0, 1), *HORIZONTAL),
        "scrim": Gradient(
            ("rgba(245, 245, 246, 0)", "rgba(245, 245, 246, 0.85)", P.LINEAR_LIGHT["window"]), (0, 0.6, 1), *VERTICAL
        ),
        "wash": Gradient((P.LINEAR_LIGHT["window"],) * 3, (0, 0.45, 1), *VERTICAL),
    }),
})


def gradients_for(scheme: SchemeName) -> MappingProxyType:
    return GRADIENTS[scheme]


def css_linear_gradient(gradient: Gradient) -> str:
    (sx, sy), (ex, ey) = gradient.start, gradient.end
    direction = "to right" if abs(ex - sx) >= abs(ey - sy) else "to bottom"
    stops = ", ".join(f"{color} {round(loc * 100)}%" for color, loc in zip(gradient.colors, gradient.locations))
    return f"linear-gradient({direction}, {stops})"
