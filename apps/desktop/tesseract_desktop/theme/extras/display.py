from ..css import css_var
from ..semantic import SchemeName
from ..tokens import BORDER_WIDTH, CONTROL_HEIGHT, RADIUS, SHADOWS, SPACING


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    s, r = SPACING, RADIUS
    hairline = f"{BORDER_WIDTH['thin']}px solid"
    control = f"{CONTROL_HEIGHT['sm']}px"
    return {
        ".to-display-page": {"background-color": css_var("surface")},
        ".to-display-toolbar": {
            "color": css_var("text"),
            "min-height": f"{CONTROL_HEIGHT['lg'] + s['xs']}px",
            "padding": f"0 {s['sm']}px 0 {s['md']}px",
            "border-bottom": f"{hairline} {css_var('divider')}",
        },
        ".to-display-toolbar button, .to-display-toolbar menubutton > button": {
            "min-width": control,
            "min-height": control,
            "padding": "0",
            "border-radius": f"{r['sm']}px",
            "background": "transparent",
            "border": "none",
            "box-shadow": "none",
            "color": css_var("textSecondary"),
        },
        ".to-display-toolbar button:hover, .to-display-toolbar menubutton > button:hover": {
            "background-color": css_var("backgroundElement"),
            "color": css_var("text"),
        },
        ".to-display-toolbar button:checked, .to-display-toolbar menubutton > button:checked": {
            "background-color": css_var("backgroundSelected"),
            "color": css_var("text"),
        },
        "toggle-group.to-display-scale": {
            "background": "transparent",
            "padding": "0",
            "border": "none",
            "box-shadow": "none",
            "border-spacing": f"{s['xs']}px",
        },
        "toggle-group.to-display-scale > separator": {"opacity": "0", "min-width": "0", "margin": "0"},
        ".to-display-toolbar toggle-group.to-display-scale:not(.flat) > toggle": {
            "min-height": f"{CONTROL_HEIGHT['sm'] - 2}px",
            "padding": f"0 {s['sm'] + 2}px",
            "margin": "0",
            "border-radius": f"{r['pill']}px",
            "border": f"{hairline} {css_var('border')}",
            "background": "transparent",
            "box-shadow": "none",
            "color": css_var("textSecondary"),
            "font-weight": "500",
        },
        ".to-display-toolbar toggle-group.to-display-scale:not(.flat) > toggle:hover": {"background-color": css_var("backgroundElement"), "color": css_var("text")},
        ".to-display-toolbar toggle-group.to-display-scale:not(.flat) > toggle:checked, "
        ".to-display-toolbar toggle-group.to-display-scale:not(.flat) > toggle:checked label": {
            "background-color": css_var("backgroundSelected"),
            "border-color": css_var("borderStrong"),
            "color": css_var("text"),
        },
        ".to-display-separator": {
            "margin": f"{s['sm']}px {s['xs']}px",
            "background-color": css_var("divider"),
        },
        ".to-display-holder": {"background-color": css_var("background")},
        ".to-display-preview": {"padding": f"{s['md']}px", "background-color": css_var("background")},
        ".to-display-stage": {"background-color": css_var("background")},
        ".to-display-stage:focus-within": {"box-shadow": f"inset 0 0 0 1px {css_var('focusRing')}"},
        ".to-display-fullscreen .to-display-stage, .to-display-fullscreen": {
            "background-color": "#000000",
            "box-shadow": "none",
        },
        ".to-vnc-view": {"transition": "opacity 200ms ease-out"},
        ".to-vnc-view:focus-visible": {"outline": "none"},
        ".to-vnc-view.dimmed": {"opacity": "0.3"},
        ".to-display-overlay": {
            "background-color": css_var("surfaceElevated"),
            "border-radius": f"{r['xl']}px",
            "border": f"{hairline} {css_var('border')}",
            "box-shadow": SHADOWS["level3"].css(),
            "margin": f"{s['xl']}px",
        },
    }
