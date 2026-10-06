from ..css import css_var
from ..palette import PROJECT_TINTS
from ..semantic import SchemeName, ink_alpha, is_dark
from ..tokens import AVATAR_SIZE, BORDER_WIDTH, CONTROL_HEIGHT, RADIUS, SPACING, transition

PANE_BAR_HEIGHT = 44
MESSAGE_INSET = 13
BODY_INDENT = AVATAR_SIZE["sm"] + SPACING["sm"]


def _px(value: float) -> str:
    return f"{value}px"


def _rgba(color: str, alpha: float) -> str:
    red, green, blue = (int(color[i:i + 2], 16) for i in (1, 3, 5))
    return f"rgba({red}, {green}, {blue}, {alpha})"


def _tint_rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    """Each project's rows, in the run list and the sidebar, carry a faint wash of its hue; hover and selection deepen it."""
    rest, hover, selected = (0.05, 0.09, 0.14) if is_dark(scheme) else (0.06, 0.1, 0.16)
    rules: dict[str, dict[str, str]] = {}
    for index, color in enumerate(PROJECT_TINTS):
        row = f"list.to-convo-list > row.to-convo-row.to-tint-{index}"
        side = f".to-side-row.to-tint-{index}"
        rules[f"{row}, {side}"] = {"background-color": _rgba(color, rest)}
        rules[f"{row}:hover, {side}:hover"] = {"background-color": _rgba(color, hover)}
        rules[f"{row}:selected"] = {"background-color": _rgba(color, selected)}
    return rules


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    s, r = SPACING, RADIUS
    thin = f"{_px(BORDER_WIDTH['thin'])} solid"
    hairline = f"{thin} {css_var('border')}"
    inset = _px(MESSAGE_INSET)
    return {
        ".to-agents-split > .sidebar-pane, .to-agents-split > widget > .sidebar-pane": {
            "background": "none",
            "box-shadow": "none",
        },
        ".to-agents-list": {"background": "none", "border-right": hairline},
        ".to-agents-detail": {"background": "none"},
        ".to-pane-bar": {
            "min-height": _px(PANE_BAR_HEIGHT),
            "padding": f"0 {_px(s['sm'])} 0 {_px(s['base'])}",
            "border-bottom": hairline,
        },
        ".to-pane-bar menubutton > button.toggle.image-button:not(.flat)": {
            "background": "none",
            "border-color": "transparent",
            "box-shadow": "none",
        },
        ".to-pane-bar menubutton > button.toggle.image-button:not(.flat):hover": {"background": css_var("backgroundElement")},
        ".to-pane-bar menubutton > button.toggle.image-button:not(.flat):checked": {"background": css_var("backgroundSelected")},
        ".to-agents-search": {"padding": f"{_px(s['sm'])} {_px(s['md'])} 0 {_px(s['md'])}"},
        "button.to-chip.to-filter-chip": {"min-height": _px(CONTROL_HEIGHT["xs"]), "padding": f"0 {_px(s['sm'])}", "margin": f"{_px(s['xs'])} {_px(s['xs'])} 0 {_px(s['xs'])}"},
        ".to-agents-search entry": {"min-height": _px(CONTROL_HEIGHT["sm"])},
        ".to-agents-list-content": {"padding": f"{_px(s['xs'])} {_px(s['sm'])} {_px(s['xl'])} {_px(s['sm'])}"},
        ".to-agents-group-title": {"padding": f"{_px(s['sm'])} {_px(10)} {_px(s['xs'])} {_px(10)}"},
        "list.to-convo-list": {"background": "none"},
        "list.to-convo-list > row.to-convo-row": {
            "padding": f"{_px(10)} {_px(s['md'])}",
            "border-radius": _px(r["md"]),
            "margin": f"{_px(s['xs'])} 0",
            "box-shadow": "none",
        },
        "list.to-convo-list > row.to-convo-row:hover": {"background-color": css_var("backgroundElement")},
        "list.to-convo-list > row.to-convo-row:selected": {
            "background-color": css_var("backgroundSelected"),
            "color": css_var("text"),
        },
        **_tint_rules(scheme),
        ".to-convo-logo": {"-gtk-icon-size": _px(12)},
        ".to-state-glyph": {"min-width": _px(16), "min-height": _px(16), "margin-top": _px(1)},
        ".to-state-succeeded": {"color": css_var("accent")},
        ".to-state-failed": {"color": css_var("danger")},
        ".to-state-cancelled": {"color": css_var("textTertiary")},
        ".to-unread-dot": {
            "min-width": _px(s["sm"] - 1),
            "min-height": _px(s["sm"] - 1),
            "border-radius": _px(r["full"]),
            "background-color": css_var("accent"),
        },
        ".to-unread-dot.top": {"margin-top": _px(6)},
        ".to-attention-card": {"padding": f"{_px(s['sm'])} {_px(10)}", "border-radius": _px(r["sm"])},
        ".to-attention-card:hover": {"background-color": css_var("backgroundElement")},
        "button.to-attention-action": {
            "min-height": _px(CONTROL_HEIGHT["xs"]),
            "padding": f"0 {_px(s['sm'])}",
            "font-size": _px(12),
            "font-weight": "500",
            "color": css_var("textSecondary"),
            "border": hairline,
        },
        "button.to-attention-action:hover": {"color": css_var("text")},
        "button.to-terminal-session": {"padding": f"{_px(s['sm'])} {_px(10)}", "border-radius": _px(r["sm"])},
        ".to-placeholder": {"padding": _px(s["xl"])},
        ".to-placeholder-glyph": {"opacity": "0.8"},
        ".to-new-convo": {"padding": f"{_px(s['4xl'])} {_px(s['xl'])} {_px(s['xl'])} {_px(s['xl'])}"},
        ".to-new-convo-card": {
            "border-radius": _px(r["xl"]),
            "border": hairline,
            "background-color": css_var("surfaceElevated"),
        },
        ".to-new-convo-card .to-pane-bar": {"border-bottom": "none", "padding": f"0 {_px(s['sm'])} 0 {_px(s['md'])}"},
        ".to-breadcrumb-chip": {
            "min-height": _px(CONTROL_HEIGHT["xs"]),
            "padding": f"0 {_px(s['sm'])}",
            "border-radius": _px(r["sm"]),
            "background-color": css_var("backgroundSelected"),
        },
        ".to-suggestions": {"padding": f"0 {_px(s['xs'])}"},
        "button.to-chip.to-suggestion": {"min-height": _px(CONTROL_HEIGHT["xs"]), "padding": f"0 {_px(10)}"},
        ".to-composer": {
            "padding": f"{_px(10)} {_px(s['md'])} {_px(s['sm'])} {_px(s['md'])}",
            "border-radius": _px(r["lg"]),
            "border": f"{thin} {css_var('borderStrong')}",
            "background-color": css_var("surfaceElevated"),
            "box-shadow": "none",
            "transition": transition("border-color"),
        },
        ".to-composer:focus-within": {"border-color": ink_alpha(scheme, 0.2)},
        ".to-composer.to-composer-large": {
            "padding": f"{_px(s['xs'])} {_px(s['md'])} {_px(s['md'])} {_px(s['md'])}",
            "border": "none",
            "border-radius": _px(r["xl"]),
            "background": "none",
        },
        ".to-composer.to-composer-large > overlay": {"margin": f"0 {_px(s['xs'])}"},
        ".to-composer.locked textview.to-composer-input": {"opacity": "0.6"},
        ".to-composer textview.to-composer-input, .to-composer textview.to-composer-input > text": {
            "background": "none",
            "color": css_var("text"),
        },
        ".to-composer-properties": {"padding": f"{_px(s['md'])} 0 {_px(s['sm'])} 0"},
        "button.to-composer-send": {
            "min-width": _px(CONTROL_HEIGHT["sm"]),
            "min-height": _px(CONTROL_HEIGHT["sm"]),
            "padding": "0",
            "border-radius": _px(r["full"]),
            "background": css_var("accent"),
            "color": css_var("textOnAccent"),
            "box-shadow": "none",
        },
        "button.to-composer-send:active": {"background": css_var("accentPressed")},
        "button.to-composer-send.pill": {
            "min-height": _px(CONTROL_HEIGHT["md"]),
            "padding": f"0 {_px(14)}",
        },
        "button.to-composer-send:disabled": {
            "background": css_var("backgroundSelected"),
            "color": css_var("textTertiary"),
        },
        ".to-composer.drop-target": {"border-color": css_var("accent"), "background-color": css_var("accentMuted")},
        "button.to-composer-attach, menubutton.to-composer-attach > button": {
            "min-width": _px(CONTROL_HEIGHT["sm"]),
            "min-height": _px(CONTROL_HEIGHT["sm"]),
            "padding": "0",
            "border-radius": _px(r["full"]),
            "color": css_var("textSecondary"),
        },
        ".to-composer.to-composer-large menubutton.to-composer-attach > button": {
            "min-width": _px(CONTROL_HEIGHT["md"]),
            "min-height": _px(CONTROL_HEIGHT["md"]),
            "border": hairline,
            "background-color": css_var("backgroundElement"),
        },
        ".to-attachment-tray": {"padding-bottom": _px(s["sm"])},
        ".to-attachment.pill": {
            "padding": _px(s["xs"]),
            "border-radius": _px(r["md"]),
            "border": hairline,
            "background-color": css_var("surface"),
        },
        ".to-attachment.thumb": {"border-radius": _px(r["md"]), "border": hairline},
        ".to-attachment.thumb.large": {"border-radius": _px(r["md"])},
        ".to-attachment.failed": {"border-color": css_var("danger")},
        ".to-attachment-icon": {
            "min-width": _px(CONTROL_HEIGHT["sm"]),
            "min-height": _px(CONTROL_HEIGHT["sm"]),
            "border-radius": _px(r["sm"]),
            "background-color": css_var("backgroundElement"),
        },
        "button.to-attachment-remove, button.to-attachment-action": {
            "min-width": _px(20),
            "min-height": _px(20),
            "padding": "0",
        },
        "button.to-attachment-remove.floating": {
            "margin": _px(s["xxs"]),
            "background-color": "rgba(0, 0, 0, 0.55)",
            "color": "white",
        },
        ".to-project-picker": {
            "min-height": _px(CONTROL_HEIGHT["sm"]),
            "padding": f"0 {_px(s['xxs'])} 0 {_px(10)}",
            "border-radius": _px(r["full"]),
            "border": hairline,
        },
        ".to-project-picker:hover": {"background-color": css_var("backgroundElement")},
        ".to-project-picker dropdown > button, .to-project-picker .to-choice-dropdown > button": {
            "min-height": _px(CONTROL_HEIGHT["sm"] - 2),
            "padding": f"0 {_px(s['sm'])} 0 {_px(s['xxs'])}",
            "background": "none",
            "border": "none",
            "box-shadow": "none",
        },
        ".to-project-picker dropdown > button arrow": {"min-width": "0", "min-height": "0", "-gtk-icon-size": "0", "margin": "0"},
        ".to-project-picker label": {"font-size": _px(13), "font-weight": "500", "color": css_var("textSecondary")},
        ".to-convo-intro": {"padding": f"0 {inset} {_px(s['xs'])} {inset}"},
        ".to-convo-notices": {"padding": f"{_px(s['md'])} {_px(s['xl'])} 0 {_px(s['xl'])}"},
        ".to-convo-footer": {"padding": f"{_px(s['sm'])} {_px(s['xl'])} {_px(s['base'])} {_px(s['xl'])}"},
        ".to-timeline-content": {"padding": f"{_px(s['lg'])} {_px(s['xl'])} {_px(s['4xl'])} {_px(s['xl'])}"},
        ".to-user-message": {
            "padding": f"{_px(s['md'])} {_px(s['md'])}",
            "border-radius": _px(r["md"]),
            "border": hairline,
            "background-color": css_var("surfaceElevated"),
        },
        ".to-assistant-message, .to-outcome, .to-activity.to-system, .to-thinking": {"padding": f"0 {inset}"},
        ".to-assistant-message": {"margin-top": _px(s["xs"])},
        ".to-author-line": {"min-height": _px(AVATAR_SIZE["sm"])},
        ".to-message-body": {"margin-left": _px(BODY_INDENT)},
        ".to-agent-avatar": {
            "min-width": _px(AVATAR_SIZE["sm"]),
            "min-height": _px(AVATAR_SIZE["sm"]),
            "border-radius": _px(r["full"]),
            "background-color": css_var("accent"),
            "color": css_var("textOnAccent"),
        },
        "button.to-tool-header": {
            "min-height": _px(CONTROL_HEIGHT["xs"]),
            "padding": f"{_px(s['xxs'])} {inset}",
            "border-radius": _px(r["sm"]),
        },
        ".to-tool-chevron": {"opacity": "0"},
        "button.to-tool-header:hover .to-tool-chevron": {"opacity": "1"},
        ".to-tool-details": {
            "margin": f"{_px(s['xs'])} {inset} {_px(s['xs'])} {_px(MESSAGE_INSET + BODY_INDENT)}",
            "padding": f"{_px(s['sm'])} {_px(s['md'])}",
            "border-radius": _px(r["md"]),
            "border": hairline,
            "background-color": css_var("codeBackground"),
        },
        ".to-outcome": {"margin-top": _px(s["xs"])},
        "button.to-previous-turn": {"border-radius": _px(r["sm"]), "padding": f"{_px(s['xxs'])} {_px(s['sm'])}"},
        ".to-code-block": {
            "border-radius": _px(r["md"]),
            "border": hairline,
            "background-color": css_var("codeBackground"),
        },
        ".to-code-block-body": {"padding": f"{_px(10)} {_px(s['md'])}"},
        ".to-code-block-actions": {
            "margin": _px(s["xs"]),
            "opacity": "0",
            "transition": transition("opacity"),
        },
        ".to-code-block:hover .to-code-block-actions": {"opacity": "1"},
        "button.to-copy-button": {
            "min-height": _px(CONTROL_HEIGHT["xs"]),
            "min-width": _px(CONTROL_HEIGHT["xs"]),
            "padding": "0",
            "background-color": css_var("surfaceElevated"),
        },
        ".to-md-quote": {
            "border-left": f"{_px(BORDER_WIDTH['focus'])} solid {css_var('borderStrong')}",
            "padding-left": _px(s["md"]),
        },
        ".to-md-table-scroller": {"border-radius": _px(r["md"]), "border": hairline},
        ".to-md-table": {"padding": f"{_px(s['sm'])} {_px(s['md'])}"},
        ".to-markdown label link": {"color": css_var("accentStrong")},
    }
