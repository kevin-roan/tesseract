from ..css import css_var
from ..semantic import SchemeName, is_dark
from ..tokens import BORDER_WIDTH, CONTROL_HEIGHT, RADIUS, SHADOWS, SPACING


def _px(value: float) -> str:
    return f"{value}px"


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    s, r = SPACING, RADIUS
    thin = f"{_px(BORDER_WIDTH['thin'])} solid"
    raised = "none" if is_dark(scheme) else SHADOWS["level2"].css()
    return {
        ".to-agents-list": {
            "background-color": css_var("surfaceSunken"),
            "border-right": f"{thin} {css_var('border')}",
        },
        ".to-agents-list-top": {"padding": f"{_px(s['base'])} {_px(s['md'])} {_px(s['md'])} {_px(s['md'])}"},
        ".to-agents-list-content": {"padding": f"0 {_px(s['sm'])} {_px(s['xl'])} {_px(s['sm'])}"},
        ".to-agents-list-top entry": {"font-size": _px(14), "min-height": _px(CONTROL_HEIGHT["sm"])},
        ".to-agents-group-title": {"margin": f"{_px(s['xs'])} {_px(s['sm'])}"},
        "list.to-convo-list": {"background": "none"},
        "list.to-convo-list > row.to-convo-row": {
            "padding": f"{_px(s['sm'])} {_px(s['sm'])}",
            "border-radius": _px(r["md"]),
            "margin": "1px 0",
        },
        "list.to-convo-list > row.to-convo-row:hover": {"background-color": css_var("backgroundElement")},
        "list.to-convo-list > row.to-convo-row:selected": {
            "background-color": css_var("accentMuted"),
            "color": css_var("text"),
        },
        ".to-state-glyph": {"min-width": _px(16), "min-height": _px(16), "margin-top": _px(2)},
        ".to-state-succeeded": {"color": css_var("success")},
        ".to-state-failed": {"color": css_var("danger")},
        ".to-state-cancelled": {"color": css_var("textTertiary")},
        ".to-attention-card": {
            "padding": _px(s["md"]),
            "border-radius": _px(r["lg"]),
            "background-color": css_var("warningMuted"),
            "border": f"{thin} {css_var('border')}",
        },
        "button.to-attention-action": {
            "min-height": _px(26),
            "padding": f"0 {_px(s['sm'])}",
            "font-size": _px(12),
            "font-weight": "600",
            "color": css_var("warning"),
        },
        "button.to-terminal-session": {"padding": _px(s["sm"]), "border-radius": _px(r["md"])},
        ".to-new-convo": {"padding": f"{_px(s['3xl'])} {_px(s['base'])}"},
        ".to-agents-hero": {
            "min-width": _px(72),
            "min-height": _px(72),
            "border-radius": _px(r["2xl"]),
            "background-color": css_var("accentMuted"),
            "color": css_var("accentStrong"),
        },
        ".to-composer": {
            "padding": f"{_px(s['md'])} {_px(s['md'])} {_px(s['sm'])} {_px(s['md'])}",
            "border-radius": _px(r["xl"]),
            "border": f"{thin} {css_var('borderStrong')}",
            "background-color": css_var("surfaceElevated"),
            "box-shadow": raised,
        },
        ".to-composer:focus-within": {"border-color": css_var("accentStrong")},
        ".to-composer.large": {"padding": f"{_px(s['base'])} {_px(s['base'])} {_px(s['sm'])} {_px(s['base'])}"},
        ".to-composer.locked": {"background-color": css_var("backgroundElement")},
        ".to-composer textview.to-composer-input, .to-composer textview.to-composer-input > text": {
            "background": "none",
            "color": css_var("text"),
        },
        "button.to-composer-send": {
            "min-width": _px(CONTROL_HEIGHT["sm"]),
            "min-height": _px(CONTROL_HEIGHT["sm"]),
            "padding": "0",
            "border-radius": _px(r["full"]),
            "background": css_var("accent"),
            "color": css_var("textOnAccent"),
        },
        "button.to-composer-send:disabled": {
            "background": css_var("backgroundSelected"),
            "color": css_var("textTertiary"),
        },
        ".to-project-picker": {
            "padding": f"0 0 0 {_px(s['sm'])}",
            "border-radius": _px(r["full"]),
            "background-color": css_var("backgroundElement"),
        },
        ".to-project-picker dropdown > button, .to-project-picker .to-choice-dropdown > button": {
            "min-height": _px(28),
            "padding": f"0 {_px(s['sm'])}",
            "background": "none",
        },
        ".to-project-picker label": {"font-size": _px(13), "font-weight": "500", "color": css_var("textSecondary")},
        "button.to-suggestion": {"padding": f"0 {_px(s['md'])}"},
        ".to-convo-header": {
            "padding": f"{_px(s['md'])} {_px(s['xl'])}",
            "border-bottom": f"{thin} {css_var('divider')}",
        },
        ".to-convo-notices": {"padding": f"{_px(s['md'])} {_px(s['xl'])} 0 {_px(s['xl'])}"},
        ".to-convo-footer": {
            "padding": f"{_px(s['sm'])} {_px(s['xl'])} {_px(s['base'])} {_px(s['xl'])}",
        },
        ".to-timeline-content": {"padding": f"{_px(s['xl'])} {_px(s['xl'])} {_px(s['4xl'])} {_px(s['xl'])}"},
        ".to-bubble-user": {
            "padding": f"{_px(s['sm'])} {_px(s['base'])}",
            "border-radius": f"{_px(r['lg'])} {_px(r['lg'])} {_px(r['xs'])} {_px(r['lg'])}",
            "background-color": css_var("bubbleUser"),
            "color": css_var("bubbleUserText"),
        },
        ".to-assistant-avatar": {
            "min-width": _px(28),
            "min-height": _px(28),
            "border-radius": _px(r["full"]),
            "background-color": css_var("accentMuted"),
            "color": css_var("accentStrong"),
        },
        ".to-tool-card": {
            "border-radius": _px(r["md"]),
            "border": f"{thin} {css_var('border')}",
            "background-color": css_var("codeBackground"),
            "margin-left": _px(40),
        },
        ".to-tool-card.error": {"border-color": css_var("danger")},
        "button.to-tool-header": {
            "padding": f"{_px(s['xs'])} {_px(s['sm'])}",
            "border-radius": _px(r["md"]),
            "min-height": _px(30),
        },
        ".to-tool-details": {"padding": f"{_px(s['xs'])} {_px(s['md'])} {_px(s['md'])} {_px(s['md'])}"},
        ".to-system-line": {"padding": f"0 {_px(s['xl'])}"},
        ".to-outcome": {"padding": _px(s["md"]), "border-radius": _px(r["lg"])},
        ".to-thinking": {"margin-left": _px(40)},
        "button.to-previous-turn": {"border-radius": _px(r["full"]), "padding": f"{_px(s['xxs'])} {_px(s['md'])}"},
        ".to-code-block": {
            "border-radius": _px(r["md"]),
            "border": f"{thin} {css_var('border')}",
            "background-color": css_var("codeBackground"),
        },
        ".to-code-block-header": {
            "padding": f"{_px(s['xxs'])} {_px(s['xs'])} {_px(s['xxs'])} {_px(s['md'])}",
            "border-bottom": f"{thin} {css_var('divider')}",
        },
        ".to-code-block-body": {"padding": f"{_px(s['sm'])} {_px(s['md'])}"},
        "button.to-copy-button": {"min-height": _px(24), "min-width": _px(24), "padding": _px(s["xxs"])},
        ".to-md-quote": {
            "border-left": f"{_px(BORDER_WIDTH['focus'])} solid {css_var('borderStrong')}",
            "padding-left": _px(s["md"]),
        },
        ".to-md-table-scroller": {
            "border-radius": _px(r["md"]),
            "border": f"{thin} {css_var('border')}",
        },
        ".to-md-table": {"padding": f"{_px(s['sm'])} {_px(s['md'])}"},
        ".to-markdown label link": {"color": css_var("accentStrong")},
    }
