from ..css import css_var
from ..semantic import SchemeName
from ..tokens import BORDER_WIDTH, CONTROL_HEIGHT, SPACING, radius_for


def _px(value: float) -> str:
    return f"{value}px"


def _dialog_rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    s, r, h = SPACING, radius_for(scheme), CONTROL_HEIGHT
    hairline = f"{_px(BORDER_WIDTH['thin'])} solid {css_var('border')}"
    return {
        ".to-dialog-header": {"padding": f"{_px(s['md'])} {_px(s['md'])} {_px(s['xs'])} {_px(s['base'])}", "min-height": _px(h["xs"])},
        ".to-breadcrumb-chip": {
            "min-height": _px(h["xs"]),
            "padding": f"0 {_px(s['sm'])}",
            "border-radius": _px(r["sm"]),
            "background-color": css_var("backgroundSelected"),
        },
        "button.to-dialog-icon-button": {
            "min-width": _px(h["xs"]), "min-height": _px(h["xs"]),
            "padding": "0",
            "border-radius": _px(r["sm"]),
            "color": css_var("textSecondary"),
        },
        "button.to-dialog-icon-button:hover": {"color": css_var("text")},
        ".to-dialog-body": {"padding": f"{_px(s['sm'])} {_px(s['base'])} {_px(s['base'])} {_px(s['base'])}"},
        ".to-dialog-footer": {"padding": f"{_px(s['sm'])} {_px(s['md'])} {_px(s['md'])} {_px(s['base'])}"},
        ".to-dialog-footer button": {"min-height": _px(h["sm"] + 2)},
        ".to-dialog-footer button.destructive-action, .to-dialog-footer button.destructive-action:hover": {
            "background": css_var("dangerSolid"),
            "color": css_var("textOnAccent"),
            "border": "none",
        },
        "entry.to-title-entry, entry.to-title-entry:focus-within": {
            "min-height": _px(h["lg"]),
            "padding": "0",
            "background": "none",
            "border": "none",
            "box-shadow": "none",
            "outline": "none",
            "font-size": _px(18),
            "font-weight": "600",
        },
        "entry.to-title-entry.monospace": {"font-size": _px(15), "font-weight": "400"},
        "entry.to-form-entry": {"background": css_var("surface")},
        "entry.error, entry.to-title-entry.error > text": {"color": css_var("danger")},
        "entry.to-form-entry.error": {"border-color": css_var("danger")},
        ".to-form-switch": {"min-height": _px(h["md"])},
        ".to-copy-field": {
            "min-height": _px(h["md"]),
            "padding": f"0 {_px(s['xs'])} 0 {_px(s['md'] - 2)}",
            "border-radius": _px(r["sm"]),
            "border": hairline,
            "background-color": css_var("surface"),
        },
        ".to-property-chips": {"margin-top": _px(s["xs"])},
        ".to-property-chips button.to-chip": {"min-height": _px(h["sm"]), "padding": f"0 {_px(s['sm'] + 2)}", "font-weight": "400"},
        ".to-pair-panel .to-qr": {"padding": _px(s["md"]), "border-radius": _px(r["md"])},
        ".to-dialog .to-segmented": {"background": css_var("surface")},
        ".to-confirm-dialog .to-dialog-header": {"padding-top": _px(s["base"])},
    }


def _settings_rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    s, r, h = SPACING, radius_for(scheme), CONTROL_HEIGHT
    hairline = f"{_px(BORDER_WIDTH['thin'])} solid {css_var('border')}"
    page = ".to-settings-page > scrolledwindow > viewport > clamp > box"
    return {
        ".to-settings-root": {"background": css_var("background"), "border-radius": _px(r["xl"])},
        ".to-settings-nav": {"min-width": _px(200), "padding": f"{_px(s['md'])} {_px(s['sm'])}"},
        ".to-settings-nav > label": {"padding": f"{_px(s['xs'])} {_px(s['sm'])} {_px(s['xs'])} {_px(s['sm'])}"},
        "list.to-settings-nav-list": {"background": "none"},
        "list.to-settings-nav-list > row": {
            "min-height": _px(h["sm"]),
            "padding": f"0 {_px(s['sm'])}",
            "margin-bottom": _px(1),
            "border-radius": _px(r["sm"]),
            "color": css_var("textSecondary"),
        },
        "list.to-settings-nav-list > row:hover": {"background": css_var("backgroundElement")},
        "list.to-settings-nav-list > row:selected": {"background": css_var("backgroundSelected"), "color": css_var("text")},
        "list.to-settings-nav-list > row:selected image": {"color": css_var("text")},
        ".to-settings-content": {
            "margin": f"{_px(s['sm'])} {_px(s['sm'])} {_px(s['sm'])} 0",
            "border-radius": _px(r["card"]),
            "border": hairline,
            "background": css_var("surface"),
        },
        ".to-settings-content > .to-dialog-header": {
            "padding": f"{_px(s['sm'])} {_px(s['sm'])} {_px(s['sm'])} {_px(s['base'])}",
            "border-bottom": f"{_px(BORDER_WIDTH['thin'])} solid {css_var('divider')}",
        },
        ".to-settings-content .to-breadcrumb-chip": {"background": "none", "padding": "0"},
        page: {"margin": f"{_px(s['lg'])} {_px(s['xl'])} {_px(s['2xl'])} {_px(s['xl'])}", "border-spacing": _px(s["xl"])},
        ".to-settings-page preferencesgroup > box": {"border-spacing": _px(s["sm"])},
        ".to-settings-page preferencesgroup > box > box.header": {"margin-bottom": "0", "padding": "0"},
        ".to-settings-page preferencesgroup label.heading": {"font-size": _px(13), "font-weight": "500", "color": css_var("text")},
        ".to-settings-page preferencesgroup label.description": {"font-size": _px(12), "color": css_var("textSecondary")},
        ".to-settings-page list.boxed-list": {
            "background": css_var("surface"),
            "border": hairline,
            "border-radius": _px(r["md"]),
        },
        ".to-settings-page list.boxed-list > row": {
            "border-bottom": f"{_px(BORDER_WIDTH['thin'])} solid {css_var('divider')}",
        },
        ".to-settings-page list.boxed-list > row:last-child": {"border-bottom": "none"},
        ".to-settings-page row .title": {"font-size": _px(13)},
        ".to-settings-page row .subtitle": {"font-size": _px(12), "color": css_var("textSecondary"), "opacity": "1"},
        ".to-settings-page row.property .title": {"font-size": _px(12), "color": css_var("textSecondary")},
        ".to-settings-page row.property .subtitle": {"font-size": _px(13), "color": css_var("text")},
        ".to-settings-page row > box.header": {"margin": f"0 {_px(s['md'] + 2)}", "padding": "0", "min-height": _px(h["xl"])},
        ".to-settings-page row > box.header > box.title": {"margin": f"{_px(s['sm'])} 0", "border-spacing": _px(s["xxs"])},
        ".to-settings-page row.expander image.expander-row-arrow": {"color": css_var("textSecondary")},
        ".to-settings-page row.expander list.nested > row": {"background": "none"},
        ".to-settings-page row.expander list.nested > row > box.header": {"min-height": _px(h["lg"])},
        ".to-settings-page row button": {"min-height": _px(h["sm"])},
        ".to-settings-page row check, .to-settings-page row radio": {"min-width": _px(14), "min-height": _px(14), "padding": "0"},
        "entry.to-row-entry, entry.to-form-entry, entry.to-row-entry:focus-within, entry.to-form-entry:focus-within": {
            "border-radius": _px(r["sm"]),
            "min-height": _px(h["md"]),
        },
        "entry.to-row-entry": {"min-width": _px(240), "background": css_var("surfaceElevated")},
    }


def _widget_rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    s, r, h = SPACING, radius_for(scheme), CONTROL_HEIGHT
    hairline = f"{_px(BORDER_WIDTH['thin'])} solid {css_var('border')}"
    return {
        ".to-notice": {
            "padding": f"{_px(s['sm'])} {_px(s['md'] - 2)}",
            "border-radius": _px(r["md"]),
            "border": hairline,
        },
        ".to-notice.to-tone-bg": {"background-color": "transparent"},
        "button.to-notice-action": {"min-height": _px(h["xs"]), "padding": f"0 {_px(s['sm'])}", "font-size": _px(12)},
        ".to-empty-actions": {"margin-top": _px(s["sm"])},
        ".to-empty-glyph": {"margin-bottom": _px(s["xs"])},
        ".to-status-badge": {"min-height": _px(20), "padding": f"0 {_px(s['sm'])} 0 {_px(s['sm'] - 1)}"},
        ".to-status-badge .to-tone-dot": {"min-width": _px(6), "min-height": _px(6)},
        ".to-section-header": {"min-height": _px(h["sm"])},
        "dropdown.to-choice-dropdown > button": {"min-height": _px(h["sm"]), "padding": f"0 {_px(s['sm'])}", "border-radius": _px(r["sm"])},
        "dropdown.to-choice-dropdown:not(.flat) > button": {"border": hairline, "background": css_var("surface")},
        "dropdown popover listview > row": {"min-height": _px(h["sm"]), "padding": f"0 {_px(s['sm'])}", "border-radius": _px(r["xs"])},
        "button.to-segment": {"font-weight": "500", "font-size": _px(12)},
        ".to-segmented": {"background": css_var("background")},
    }


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    return {**_widget_rules(scheme), **_dialog_rules(scheme), **_settings_rules(scheme)}
