from ..css import css_var
from ..semantic import SchemeName
from ..tokens import BORDER_WIDTH, RADIUS, SPACING


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    return {
        "button.to-series-toggle": {
            "padding": f"{SPACING['sm']}px {SPACING['md']}px",
            "border-radius": f"{RADIUS['md']}px",
            "border": f"{BORDER_WIDTH['thin']}px solid {css_var('border')}",
            "background": "transparent",
            "box-shadow": "none",
            "opacity": "0.55",
            "transition": "opacity 150ms ease, background 150ms ease, border-color 150ms ease",
        },
        "button.to-series-toggle:hover": {"background": css_var("backgroundElement"), "opacity": "0.8"},
        "button.to-series-toggle:checked": {
            "background": css_var("surfaceElevated"),
            "border-color": css_var("borderStrong"),
            "opacity": "1",
        },
        "button.to-series-toggle.compact": {
            "padding": f"{SPACING['xs']}px {SPACING['md']}px",
            "border-radius": f"{RADIUS['full']}px",
        },
        ".to-resource-history": {"padding-top": f"{SPACING['md']}px"},
        ".to-timeseries": {"margin-top": f"{SPACING['base']}px"},
    }
