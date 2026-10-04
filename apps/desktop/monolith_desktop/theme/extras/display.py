from ..css import css_var
from ..semantic import SchemeName, is_dark

STAGE_RADIUS = "12px"


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    stage = css_var("background") if is_dark(scheme) else css_var("backgroundSelected")
    return {
        ".to-display-toolbar": {
            "color": css_var("text"),
            "padding": "10px 16px",
            "border-bottom": f"1px solid {css_var('divider')}",
        },
        ".to-display-separator": {
            "margin": "6px 4px",
        },
        ".to-display-holder": {
            "padding": "12px",
        },
        ".to-display-preview": {
            "padding": "12px",
        },
        ".to-display-stage": {
            "background-color": stage,
            "border-radius": STAGE_RADIUS,
            "border": f"1px solid {css_var('border')}",
        },
        ".to-display-stage:focus-within": {
            "border-color": css_var("focusRing"),
        },
        ".to-display-fullscreen .to-display-stage": {
            "border-radius": "0",
            "border": "none",
            "background-color": "#000000",
        },
        ".to-display-fullscreen": {
            "background-color": "#000000",
        },
        ".to-vnc-view": {
            "transition": "opacity 200ms ease-out",
        },
        ".to-vnc-view:focus-visible": {
            "outline": "none",
        },
        ".to-vnc-view.dimmed": {
            "opacity": "0.3",
        },
        ".to-display-overlay": {
            "background-color": css_var("surfaceElevated"),
            "border-radius": "16px",
            "border": f"1px solid {css_var('border')}",
            "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.35)",
            "margin": "24px",
        },
    }
