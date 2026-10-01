from ...widgets.terminal.palette import palette_for
from ..css import css_var
from ..semantic import SchemeName
from ..tokens import RADIUS, SPACING


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    palette = palette_for(scheme)
    s, r = SPACING, RADIUS
    inset = s["md"]
    text_inset = s["md"] + s["sm"]
    return {
        ".to-terminal-sidebar": {
            "background-color": css_var("surface"),
            "border-right": f"1px solid {css_var('border')}",
        },
        ".to-terminal-launchers": {
            "padding": f"{inset}px {inset}px 0",
        },
        ".to-terminal-launch splitbutton > button, .to-terminal-launch splitbutton > menubutton > button": {
            "min-height": "32px",
            "background-color": css_var("backgroundElement"),
            "box-shadow": "none",
        },
        ".to-terminal-launch splitbutton > button:hover, .to-terminal-launch splitbutton > menubutton > button:hover": {
            "background-color": css_var("backgroundSelected"),
        },
        ".to-terminal-launch splitbutton > button": {
            "padding": f"0 {s['md']}px",
            "border-radius": f"{r['sm']}px 0 0 {r['sm']}px",
        },
        ".to-terminal-launch splitbutton > menubutton > button": {
            "padding": f"0 {s['xs']}px",
            "border-radius": f"0 {r['sm']}px {r['sm']}px 0",
        },
        ".to-terminal-launch splitbutton > separator": {
            "background-color": css_var("border"),
        },
        ".to-terminal-sidebar-heading": {
            "padding": f"{s['lg']}px {text_inset}px {s['xs']}px",
        },
        ".to-terminal-sidebar-empty": {
            "padding": f"{s['sm']}px {text_inset}px {s['base']}px",
        },
        "list.to-terminal-list": {
            "background": "none",
            "padding": f"0 {inset}px {inset}px",
        },
        "list.to-terminal-list > row.to-terminal-row": {
            "padding": f"{s['sm'] + 2}px {s['xs']}px {s['sm'] + 2}px {s['sm']}px",
            "margin": "1px 0",
            "border-radius": f"{r['md']}px",
            "background": "none",
        },
        "list.to-terminal-list > row.to-terminal-row:hover": {
            "background-color": css_var("backgroundElement"),
        },
        "list.to-terminal-list > row.to-terminal-row:selected": {
            "background-color": css_var("backgroundSelected"),
            "color": css_var("text"),
        },
        ".to-terminal-row-ended .to-terminal-row-icon, .to-terminal-row-ended .to-terminal-row-text": {
            "opacity": "0.6",
        },
        "button.to-terminal-row-delete": {
            "min-width": "26px",
            "min-height": "26px",
            "padding": "0",
            "border-radius": f"{r['xs'] + 2}px",
            "color": css_var("textTertiary"),
            "opacity": "0",
        },
        "row.to-terminal-row:hover button.to-terminal-row-delete, row.to-terminal-row:selected button.to-terminal-row-delete, "
        "button.to-terminal-row-delete:focus-visible": {
            "opacity": "1",
        },
        "button.to-terminal-row-delete:hover": {
            "background-color": css_var("dangerMuted"),
            "color": css_var("danger"),
        },
        ".to-terminal-toolbar": {
            "padding": f"{SPACING['md']}px {SPACING['base']}px",
        },
        ".to-terminal-stage": {
            "margin": f"0 {SPACING['base']}px {SPACING['base']}px",
        },
        ".to-terminal-frame": {
            "background-color": palette.background,
            "border": f"1px solid {css_var('border')}",
            "border-radius": f"{RADIUS['md']}px",
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
            "margin": f"{SPACING['xs']}px {SPACING['xxs']}px",
        },
        "scrollbar.to-terminal-scrollbar slider": {
            "min-width": "6px",
            "background-color": css_var("borderStrong"),
        },
        ".to-terminal-banner": {
            "margin": f"{SPACING['base']}px",
        },
    }
