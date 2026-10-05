from ..css import css_var
from ..semantic import SchemeName
from ..tokens import BORDER_WIDTH, CONTROL_HEIGHT, RADIUS, SPACING


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    hairline = f"{BORDER_WIDTH['thin']}px solid"
    return {
        "button.to-series-toggle": {
            "min-height": f"{CONTROL_HEIGHT['xs']}px",
            "padding": f"0 {SPACING['sm'] + 2}px",
            "border-radius": f"{RADIUS['full']}px",
            "border": f"{hairline} {css_var('border')}",
            "background": "transparent",
            "box-shadow": "none",
            "opacity": "0.5",
            "transition": "opacity 150ms ease, background 150ms ease, border-color 150ms ease",
        },
        "button.to-series-toggle:hover": {"background": css_var("backgroundElement"), "opacity": "0.8"},
        "button.to-series-toggle:checked": {"border-color": css_var("border"), "opacity": "1"},
        ".to-series-value": {"font-feature-settings": '"tnum"', "font-weight": "500"},
        ".to-resource-history": {
            "padding": f"{SPACING['md']}px {SPACING['base']}px {SPACING['sm']}px",
            "border": f"{hairline} {css_var('border')}",
            "border-radius": f"{RADIUS['card']}px",
        },
        ".to-timeseries": {"margin-top": f"{SPACING['md']}px"},
    }
