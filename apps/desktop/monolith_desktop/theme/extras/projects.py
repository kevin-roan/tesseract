from ..css import css_var
from ..semantic import SchemeName
from ..tokens import BORDER_WIDTH, CONTROL_HEIGHT, SPACING, radius_for


def _px(value: float) -> str:
    return f"{value:g}px"


ROW_HEIGHT = 40
GROUP_HEIGHT = 36
PROGRESS_WIDTH = 80
CARD_MIN_WIDTH = 280


def _list(scheme: SchemeName) -> dict[str, dict[str, str]]:
    s, r = SPACING, radius_for(scheme)
    hairline = f"{_px(BORDER_WIDTH['thin'])} solid"
    h = CONTROL_HEIGHT
    return {
        ".to-list-toolbar": {"padding": f"{_px(s['sm'])} {_px(s['md'])} {_px(s['sm'])} {_px(s['md'])}"},
        "button.to-pill-tab": {
            "min-height": _px(h["sm"]),
            "padding": f"0 {_px(s['md'] - 2)}",
            "border-radius": _px(r["pill"]),
            "border": f"{hairline} {css_var('border')}",
            "background": "transparent",
            "color": css_var("textSecondary"),
            "box-shadow": "none",
        },
        "button.to-pill-tab:hover": {"background": css_var("backgroundElement"), "color": css_var("text")},
        "button.to-pill-tab:checked": {
            "background": css_var("backgroundSelected"),
            "border-color": css_var("borderStrong"),
            "color": css_var("text"),
        },
        "button.to-toolbar-button": {
            "min-width": _px(h["sm"]),
            "min-height": _px(h["sm"]),
            "padding": "0",
            "border-radius": _px(r["pill"]),
            "border": f"{hairline} {css_var('border')}",
            "color": css_var("textSecondary"),
        },
        "button.to-toolbar-button:hover": {"color": css_var("text")},
        "button.to-toolbar-button:checked": {"background": css_var("backgroundSelected"), "color": css_var("text")},
        ".to-list-toolbar dropdown > button": {
            "min-height": _px(h["sm"]),
            "padding": f"0 {_px(s['sm'])} 0 {_px(s['md'] - 2)}",
            "border-radius": _px(r["pill"]),
            "border": f"{hairline} {css_var('border')}",
            "background": "transparent",
            "color": css_var("textSecondary"),
        },
        ".to-list-toolbar dropdown > button:hover": {"background": css_var("backgroundElement"), "color": css_var("text")},
        "entry.to-list-search, .to-list-search": {
            "margin": f"0 {_px(s['md'])} {_px(s['sm'])} {_px(s['md'])}",
            "min-height": _px(h["sm"]),
            "border-radius": _px(r["sm"]),
        },
        ".to-list-notice": {"margin": f"0 {_px(s['md'])} {_px(s['sm'])} {_px(s['md'])}"},
        ".to-list-body": {"padding": f"0 {_px(s['sm'])} {_px(s['base'])} {_px(s['sm'])}"},
        ".to-group-header": {
            "min-height": _px(GROUP_HEIGHT),
            "padding": f"0 {_px(s['xs'])} 0 {_px(s['md'])}",
            "border-radius": _px(r["sm"]),
            "background-color": css_var("surfaceElevated"),
        },
        "button.to-group-action": {
            "min-width": _px(h["xs"]),
            "min-height": _px(h["xs"]),
            "border-radius": _px(r["sm"]),
            "color": css_var("textSecondary"),
        },
        "button.to-group-action:hover": {"color": css_var("text")},
        ".to-list-placeholder": {"min-height": _px(ROW_HEIGHT), "padding": f"0 {_px(s['md'])}"},
        "list.to-record-list": {"background": "none", "border": "none", "padding": "0"},
        "list.to-record-list > row": {
            "padding": "0",
            "border-radius": _px(r["sm"]),
            "background": "none",
            "box-shadow": "none",
            "outline-offset": _px(-2),
        },
        "list.to-record-list > row:hover": {"background-color": css_var("backgroundElement")},
        "list.to-record-list.divided > row": {"border-radius": "0", "border-bottom": f"{hairline} {css_var('divider')}"},
        "list.to-record-list.divided > row:last-child": {"border-bottom": "none"},
        ".to-record-row": {"min-height": _px(ROW_HEIGHT), "padding": f"0 {_px(s['sm'])} 0 {_px(s['md'])}"},
        ".to-record-code": {"min-width": _px(18), "font-weight": "600"},
        ".to-record-progress": {"min-width": _px(PROGRESS_WIDTH)},
        ".to-hover-actions": {
            "margin-right": _px(s["xs"]),
            "padding": f"0 {_px(s['xs'])} 0 {_px(s['sm'])}",
            "border-radius": _px(r["sm"]),
            "background-color": css_var("backgroundElement"),
        },
        "button.to-row-action": {
            "min-width": _px(h["xs"]),
            "min-height": _px(h["xs"]),
            "border-radius": _px(r["sm"]),
            "color": css_var("textSecondary"),
        },
        "button.to-row-action:hover": {"color": css_var("text")},
        "button.to-row-action.labeled": {"padding": f"0 {_px(s['sm'])}", "font-size": _px(12)},
        "button.to-danger-button:hover": {"color": css_var("danger")},
        "button.to-active-button": {"background-color": css_var("backgroundSelected"), "color": css_var("text")},
    }


def _cards(scheme: SchemeName) -> dict[str, dict[str, str]]:
    s, r = SPACING, radius_for(scheme)
    hairline = f"{_px(BORDER_WIDTH['thin'])} solid"
    h = CONTROL_HEIGHT
    return {
        ".to-project-groups": {"padding": f"{_px(s['xs'])} {_px(s['md'])} {_px(s['xl'])} {_px(s['md'])}"},
        ".to-project-section": {"padding": f"0 {_px(s['xxs'])}"},
        ".to-project-card": {"min-width": _px(CARD_MIN_WIDTH)},
        ".to-surface.to-project-surface": {
            "padding": _px(s["base"]),
            "border-radius": _px(r["card"]),
            "border": f"{hairline} {css_var('border')}",
            "background": css_var("surface"),
            "box-shadow": "none",
        },
        "button.to-pressable:hover > .to-surface.to-project-surface": {"background": css_var("backgroundElement")},
        "button.to-pressable:active > .to-surface.to-project-surface": {"background": css_var("backgroundSelected")},
        "button.to-pressable:focus-visible > .to-project-surface": {"border-color": css_var("borderStrong")},
        ".to-project-surface .to-icon-badge": {"min-width": _px(h["md"]), "min-height": _px(h["md"])},
        ".to-project-ask-space": {"min-width": _px(h["sm"])},
        "button.to-project-ask": {
            "margin": f"{_px(s['md'])} {_px(s['md'])} 0 0",
            "min-width": _px(h["sm"]),
            "min-height": _px(h["sm"]),
            "padding": "0",
            "border-radius": _px(r["sm"]),
            "color": css_var("textSecondary"),
        },
        "button.to-project-ask:hover": {"background": css_var("backgroundSelected"), "color": css_var("text")},
        ".to-project-tag": {
            "padding": f"0 {_px(s['sm'])}",
            "min-height": _px(h["xs"] - 4),
            "border-radius": _px(r["pill"]),
            "border": f"{hairline} {css_var('border')}",
        },
    }


def _detail(scheme: SchemeName) -> dict[str, dict[str, str]]:
    s, r = SPACING, radius_for(scheme)
    hairline = f"{_px(BORDER_WIDTH['thin'])} solid"
    return {
        ".to-detail-body": {"padding": f"{_px(s['lg'])} {_px(s['xl'])} {_px(s['3xl'])} {_px(s['xl'])}"},
        ".to-detail-crumb": {"margin-bottom": _px(s["xs"])},
        ".to-detail-props": {"margin-top": _px(s["sm"])},
        ".to-property-chip": {
            "min-height": _px(CONTROL_HEIGHT["xs"]),
            "padding": f"0 {_px(s['sm'] + 2)}",
            "border-radius": _px(r["pill"]),
            "border": f"{hairline} {css_var('border')}",
            "background-color": "transparent",
        },
        ".to-property-chip label": {"color": css_var("textSecondary")},
        ".to-detail-actions": {"margin-top": _px(s["md"])},
        ".to-detail-tabs": {
            "margin-top": _px(s["lg"]),
            "padding-bottom": _px(s["sm"]),
            "border-bottom": f"{hairline} {css_var('divider')}",
        },
        ".to-detail-tab": {"margin-top": _px(s["md"])},
        ".to-props-list": {
            "padding": f"{_px(s['xs'])} {_px(s['md'])}",
            "border-radius": _px(r["md"]),
            "border": f"{hairline} {css_var('border')}",
        },
        ".to-log-panel": {"margin-top": _px(s["xs"])},
        ".to-log-panel-header": {"min-height": _px(CONTROL_HEIGHT["sm"]), "padding": f"0 {_px(s['xs'])} 0 {_px(s['md'])}"},
        ".to-log-view, .to-log-view > textview, .to-log-view text": {"background-color": css_var("background")},
        ".to-log-view": {"border-radius": _px(r["md"]), "border": f"{hairline} {css_var('border')}"},
        ".to-log-view textview": {"padding": f"{_px(s['sm'] + 2)} {_px(s['md'])}", "font-size": _px(12)},
    }


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    return {**_list(scheme), **_cards(scheme), **_detail(scheme)}
