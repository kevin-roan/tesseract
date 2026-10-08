from ...widgets.terminal.palette import palette_for
from ..css import css_var
from ..semantic import SchemeName
from ..tokens import BORDER_WIDTH, CONTROL_HEIGHT, RADIUS, SHADOWS, SPACING


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    palette = palette_for(scheme)
    s, r = SPACING, RADIUS
    hairline = f"{BORDER_WIDTH['thin']}px solid"
    chip = ".to-terminal-launch splitbutton > button, .to-terminal-launch splitbutton > menubutton > button"
    return {
        ".to-terminal-sidebar": {
            "background-color": css_var("surface"),
            "border-right": f"{hairline} {css_var('divider')}",
        },
        ".to-terminal-sidebar-heading": {
            "min-height": f"{CONTROL_HEIGHT['xl']}px",
            "padding": f"0 {s['base']}px",
        },
        ".to-terminal-launchers": {
            "padding": f"0 {s['md']}px {s['sm']}px",
        },
        ".to-terminal-launch splitbutton": {
            "border": f"{hairline} {css_var('border')}",
            "border-radius": f"{r['pill']}px",
        },
        chip: {
            "min-height": f"{CONTROL_HEIGHT['sm'] - 2}px",
            "background": "transparent",
            "box-shadow": "none",
            "color": css_var("textSecondary"),
            "font-weight": "500",
        },
        ".to-terminal-launch splitbutton > button:hover, .to-terminal-launch splitbutton > menubutton > button:hover": {
            "background-color": css_var("backgroundElement"),
            "color": css_var("text"),
        },
        ".to-terminal-launch splitbutton > button": {
            "padding": f"0 {s['sm']}px 0 {s['sm'] + 2}px",
            "border-radius": f"{r['pill']}px 0 0 {r['pill']}px",
        },
        ".to-terminal-launch splitbutton > menubutton > button": {
            "padding": f"0 {s['sm'] - 2}px 0 {s['xs']}px",
            "border-radius": f"0 {r['pill']}px {r['pill']}px 0",
        },
        ".to-terminal-launch splitbutton > separator": {
            "background-color": css_var("border"),
        },
        ".to-terminal-sidebar-empty": {
            "padding": f"{s['base']}px",
        },
        "list.to-terminal-list": {
            "background": "none",
            "padding": f"{s['xxs']}px {s['sm']}px {s['sm']}px",
        },
        "list.to-terminal-list > row.to-terminal-row": {
            "padding": f"{s['sm'] - 1}px {s['xs']}px {s['sm'] - 1}px {s['sm']}px",
            "margin": "1px 0",
            "border-radius": f"{r['sm']}px",
            "background": "none",
        },
        "list.to-terminal-list > row.to-terminal-row:hover": {
            "background-color": css_var("backgroundElement"),
        },
        "list.to-terminal-list > row.to-terminal-row:selected": {
            "background-color": css_var("backgroundSelected"),
            "color": css_var("text"),
        },
        ".to-terminal-row-dot": {"min-width": "6px", "min-height": "6px"},
        ".to-terminal-row-ended .to-terminal-row-icon, .to-terminal-row-ended .to-terminal-row-text": {
            "opacity": "0.6",
        },
        "button.to-terminal-row-delete": {
            "min-width": f"{CONTROL_HEIGHT['xs']}px",
            "min-height": f"{CONTROL_HEIGHT['xs']}px",
            "padding": "0",
            "border-radius": f"{r['xs']}px",
            "color": css_var("textTertiary"),
            "opacity": "0",
        },
        "row.to-terminal-row:hover button.to-terminal-row-delete, row.to-terminal-row:selected button.to-terminal-row-delete, "
        "button.to-terminal-row-delete:focus-visible": {
            "opacity": "1",
        },
        "row.to-terminal-row:hover .to-terminal-row-dot, row.to-terminal-row:selected .to-terminal-row-dot": {
            "opacity": "0",
        },
        "button.to-terminal-row-delete:hover": {
            "background-color": css_var("dangerMuted"),
            "color": css_var("danger"),
        },
        ".to-terminal-toolbar": {
            "min-height": f"{CONTROL_HEIGHT['lg'] + s['xs']}px",
            "padding": f"0 {s['sm']}px 0 {s['md']}px",
            "background-color": css_var("surface"),
            "border-bottom": f"{hairline} {css_var('divider')}",
        },
        ".to-terminal-toolbar menubutton > button": {
            "background": "transparent",
            "border": "none",
            "box-shadow": "none",
        },
        ".to-terminal-toolbar menubutton > button:hover, .to-terminal-toolbar menubutton > button:checked": {
            "background-color": css_var("backgroundElement"),
        },
        ".to-terminal-toolbar button": {
            "min-width": f"{CONTROL_HEIGHT['sm']}px",
            "min-height": f"{CONTROL_HEIGHT['sm']}px",
            "padding": "0",
            "border-radius": f"{r['sm']}px",
        },
        ".to-terminal-frame": {
            "background-color": css_var("surface"),
        },
        ".to-terminal": {
            "background-color": palette.background,
        },
        ".to-terminal-canvas:focus-visible": {
            "outline": "none",
        },
        "scrollbar.to-terminal-scrollbar": {
            "background-color": "transparent",
            "border": "none",
            "margin": f"{s['xs']}px {s['xxs']}px",
        },
        "scrollbar.to-terminal-scrollbar slider": {
            "min-width": "6px",
            "background-color": css_var("borderStrong"),
        },
        ".to-terminal-banner": {
            "margin": f"{s['md']}px",
        },
        # The banner floats over live terminal output, so it needs an opaque fill to stay legible.
        ".to-notice.to-tone-bg.to-terminal-banner": {
            "background-color": css_var("surfaceElevated"),
            "box-shadow": SHADOWS["level2"].css(),
        },
    }
