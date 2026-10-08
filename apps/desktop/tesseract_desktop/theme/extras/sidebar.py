from ..css import css_var
from ..semantic import SchemeName
from ..tokens import BORDER_WIDTH, CONTROL_HEIGHT, RADIUS, SPACING, radius_for, transition

RuleSet = dict[str, dict[str, str]]

ROW_HEIGHT = 28
ACTION_SIZE = 22
RESIZE_HANDLE_WIDTH = 6


def px(value: float) -> str:
    return f"{value:g}px"


def _flat(**extra: str) -> dict[str, str]:
    return {"background": "none", "box-shadow": "none", "border": "none", **extra}


def _header(scheme: SchemeName) -> RuleSet:
    s, r = SPACING, RADIUS
    control = px(CONTROL_HEIGHT["sm"])
    return {
        "toolbarview.to-sidebar": {"background": "none"},
        "headerbar.to-sidebar-header > windowhandle > box": {"padding-left": px(s["sm"])},
        "menubutton.to-workspace-switcher > button": _flat(
            **{"min-height": control, "padding": f"0 {px(s['xs'] + 2)}", "border-radius": px(r["sm"]), "color": css_var("text")},
        ),
        "menubutton.to-workspace-switcher > button:hover": {"background-color": css_var("backgroundElement")},
        "menubutton.to-workspace-switcher > button:checked": {"background-color": css_var("backgroundSelected")},
        "headerbar.to-sidebar-header menubutton.to-workspace-switcher > button": {"min-width": "0", "color": css_var("text")},
        ".to-brand-logo": {"-gtk-icon-size": px(20)},
        "headerbar.to-sidebar-header button.to-sidebar-compose": {
            "border-radius": px(r["full"]),
            "background-color": css_var("backgroundElement"),
            "color": css_var("text"),
        },
        "headerbar.to-sidebar-header button.to-sidebar-compose:hover": {"background-color": css_var("backgroundSelected")},
    }


def _nav(scheme: SchemeName) -> RuleSet:
    s, r = SPACING, RADIUS
    row = px(ROW_HEIGHT)
    rows = {"min-height": row, "padding": f"0 {px(s['sm'])}", "border-radius": px(r["sm"])}
    return {
        ".to-sidebar-body": {"padding": f"0 {px(s['sm'])} {px(s['md'])}"},
        ".to-side-group": {"margin-bottom": px(s["md"])},
        ".to-side-section": {"min-height": row, "margin-bottom": px(s["xxs"])},
        "button.to-side-section-toggle": _flat(
            **{"min-height": px(CONTROL_HEIGHT["xs"]), "padding": f"0 {px(s['sm'])}", "border-radius": px(r["sm"])},
        ),
        "button.to-side-section-toggle:hover .to-text-overline, button.to-side-section-toggle:hover .to-caret": {
            "color": css_var("text"),
        },
        "list.to-nav-list": {"background": "none"},
        "list.to-nav-list > row": {
            **rows,
            "margin-bottom": px(BORDER_WIDTH["thin"]),
            "background": "none",
            "color": css_var("text"),
        },
        "list.to-nav-list > row:hover": {"background-color": css_var("backgroundElement")},
        "list.to-nav-list > row:active": {"background-color": css_var("backgroundSelected")},
        "list.to-nav-list > row:selected": {"background-color": css_var("backgroundSelected"), "color": css_var("text")},
        "list.to-nav-list > row:selected image": {"color": css_var("text")},
        ".to-nav-row .to-sidebar-badge": {
            "min-width": "0",
            "min-height": "0",
            "padding": "0",
            "background": "none",
            "color": css_var("textSecondary"),
            "font-size": px(12),
        },
        ".to-side-row": {"border-radius": px(r["sm"])},
        ".to-side-row:hover": {"background-color": css_var("backgroundElement")},
        "button.to-side-row-main": _flat(**rows, color=css_var("text")),
        "button.to-side-row-main:active": {"background-color": css_var("backgroundSelected")},
        "button.to-side-row-action": _flat(
            **{
                "min-width": px(ACTION_SIZE),
                "min-height": px(ACTION_SIZE),
                "margin-right": px(s["xxs"]),
                "padding": "0",
                "border-radius": px(r["xs"]),
                "color": css_var("textSecondary"),
            },
        ),
        "button.to-side-row-action:hover": {"background-color": css_var("backgroundSelected"), "color": css_var("text")},
        "button.to-side-hover, button.to-side-section-action": {"opacity": "0"},
        (
            ".to-side-row:hover button.to-side-hover, button.to-side-hover:focus-visible, "
            ".to-side-section:hover button.to-side-section-action, button.to-side-section-action:focus-visible"
        ): {"opacity": "1"},
        ".to-side-indicator image": {"color": css_var("textSecondary")},
        ".to-side-count": {"font-size": px(12)},
        ".to-side-runs": {"padding": f"{px(BORDER_WIDTH['thin'])} 0 {px(s['xs'])}"},
        "button.to-side-run": _flat(
            **{"min-height": px(ROW_HEIGHT - 2), "padding": f"0 {px(s['sm'])}", "border-radius": px(r["sm"])},
        ),
        "button.to-side-run:hover": {"background-color": css_var("backgroundElement")},
        "button.to-side-run:hover .to-text-body-small, button.to-side-run.running .to-text-body-small": {"color": css_var("text")},
        ".to-side-empty-runs": {"margin-top": px(s["xxs"]), "margin-bottom": px(s["xs"])},
        ".to-side-status": {"margin": f"{px(s['xs'])} {px(s['sm'])}"},
        "button.to-side-link": _flat(
            **{
                "margin": f"0 {px(s['xs'])}",
                "padding": f"0 {px(s['xs'])}",
                "min-height": px(CONTROL_HEIGHT["xs"]),
                "color": css_var("accentStrong"),
                "font-weight": "500",
            },
        ),
        "button.to-side-link:hover": {"background-color": css_var("backgroundElement")},
    }


def _bottom(scheme: SchemeName) -> RuleSet:
    s, r = SPACING, RADIUS
    small = px(CONTROL_HEIGHT["xs"])
    return {
        ".to-sidebar-bottom": {"padding": f"{px(s['xs'])} {px(s['sm'])} {px(s['sm'])}"},
        ".to-composer.to-side-composer": {
            "margin-bottom": px(s["xs"]),
            "padding": f"{px(s['sm'])} {px(s['xs'] + 2)} {px(s['xs'] + 2)} {px(s['sm'] + 2)}",
            "border-radius": px(radius_for(scheme)["md"]),
            "border": f"{px(BORDER_WIDTH['thin'])} solid {css_var('border')}",
            "background-color": f"color-mix(in srgb, {css_var('surface')} 50%, {css_var('background')})",
            "box-shadow": "none",
        },
        ".to-composer.to-side-composer:focus-within": {"border-color": css_var("borderStrong")},
        ".to-side-composer textview, .to-side-composer textview > text": {
            "background": "none",
            "color": css_var("text"),
            "font-size": px(13),
        },
        ".to-side-composer scrolledwindow": {"min-height": px(20)},
        ".to-side-composer button.to-composer-send": {
            "min-width": small,
            "min-height": small,
            "padding": "0",
            "border-radius": px(r["full"]),
            "background": css_var("accent"),
            "color": css_var("textOnAccent"),
        },
        ".to-side-composer button.to-composer-send:disabled": {
            "background": css_var("backgroundSelected"),
            "color": css_var("textTertiary"),
        },
        ".to-side-composer menubutton.to-composer-attach > button, .to-side-composer button.to-composer-attach": {
            "min-width": small,
            "min-height": small,
            "border-radius": px(r["sm"]),
            "color": css_var("textSecondary"),
        },
        ".to-side-composer dropdown.to-composer-project > button": _flat(
            **{
                "min-height": small,
                "padding": f"0 {px(s['xs'] + 2)}",
                "border-radius": px(r["sm"]),
                "color": css_var("textSecondary"),
            },
        ),
        ".to-side-composer dropdown.to-composer-project > button:hover": {"background-color": css_var("backgroundElement")},
        ".to-side-composer dropdown.to-composer-project > button label": {"font-size": px(12)},
        "button.to-sidebar-status": _flat(
            **{"min-height": px(ROW_HEIGHT + 4), "padding": f"0 {px(s['sm'])}", "border-radius": px(r["sm"])},
        ),
        "button.to-sidebar-status:hover": {"background-color": css_var("backgroundElement")},
    }


def _resize_handle() -> RuleSet:
    return {
        ".to-resize-handle": {
            "min-width": px(RESIZE_HANDLE_WIDTH),
            "background": "none",
            "transition": transition("box-shadow"),
        },
        ".to-resize-handle:hover, .to-resize-handle.dragging": {
            "box-shadow": f"inset -{px(BORDER_WIDTH['thin'])} 0 {css_var('borderStrong')}",
        },
    }


def rules(scheme: SchemeName) -> RuleSet:
    return {**_header(scheme), **_nav(scheme), **_bottom(scheme), **_resize_handle()}
