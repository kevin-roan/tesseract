from ..css import css_var
from ..gradients import css_linear_gradient, gradients_for
from ..semantic import SchemeName
from ..tokens import BASE_FONT_SIZE, BORDER_WIDTH, CONTROL_HEIGHT, RADIUS, SHADOWS, SPACING, WINDOW_CONTROL

RuleSet = dict[str, dict[str, str]]


def px(value: float) -> str:
    return f"{value:g}px"


def _titlebar(scheme: SchemeName) -> RuleSet:
    s, r = SPACING, RADIUS
    size = px(WINDOW_CONTROL["size"])
    return {
        "headerbar.to-titlebar": {
            "min-height": px(52),
            "background": "none",
            "box-shadow": "none",
            "color": css_var("text"),
        },
        "headerbar.to-titlebar > windowhandle > box": {"padding": f"{px(s['sm'])} {px(s['md'])}"},
        "headerbar.to-titlebar button": {"border-radius": px(r["sm"])},
        "headerbar.to-titlebar button.back": {"margin-top": px(s["xs"]), "margin-bottom": px(s["xs"]), "min-height": "0"},
        "headerbar.to-titlebar:backdrop > windowhandle": {"filter": "none"},
        "headerbar.to-titlebar:backdrop .to-header-title, headerbar.to-titlebar:backdrop .to-brand": {"opacity": "0.7"},
        ".to-header-title": {"margin-left": px(s["xs"])},
        ".to-titlebar-divider": {
            "min-width": px(BORDER_WIDTH["thin"]),
            "margin": f"{px(s['md'])} {px(s['xs'])}",
            "background-color": css_var("border"),
        },
        ".to-window-controls": {"margin-left": px(s["xs"])},
        "headerbar.to-titlebar button.to-window-control": {
            "min-width": size,
            "min-height": size,
            "padding": "0",
            "border-radius": px(r["full"]),
            "background": css_var("backgroundElement"),
            "color": css_var("textSecondary"),
            "box-shadow": "none",
            "border": "none",
            "outline-offset": "-2px",
        },
        "headerbar.to-titlebar button.to-window-control:hover": {"background": css_var("backgroundSelected"), "color": css_var("text")},
        "headerbar.to-titlebar button.to-window-control:active": {"background": css_var("borderStrong"), "color": css_var("text")},
        "headerbar.to-titlebar button.to-window-control.close:hover": {"background": css_var("dangerSolid"), "color": "#ffffff"},
        "headerbar.to-titlebar button.to-window-control.close:active": {"background": css_var("danger"), "color": "#ffffff"},
        "window:backdrop headerbar.to-titlebar button.to-window-control": {"background": "none", "color": css_var("textTertiary")},
        "window:backdrop headerbar.to-titlebar button.to-window-control:hover": {"background": css_var("backgroundElement")},
        ".to-brand-tile": {
            "min-width": px(26),
            "min-height": px(26),
            "border-radius": px(r["sm"]),
            "background-image": css_linear_gradient(gradients_for(scheme)["brand"]),
            "color": css_var("textOnAccent"),
        },
        ".to-brand": {"margin-left": px(s["xs"])},
    }


def _sidebar(scheme: SchemeName) -> RuleSet:
    s, r = SPACING, RADIUS
    return {
        "toolbarview.to-sidebar": {"background-color": css_var("surface" if scheme == "dark" else "surfaceSunken")},
        ".to-sidebar-body": {"padding": f"0 0 {px(s['md'])} 0"},
        "button.to-new-conversation": {
            "margin": f"{px(s['xxs'])} {px(s['md'])} {px(s['sm'])}",
            "padding": f"0 {px(s['md'])}",
            "min-height": px(CONTROL_HEIGHT["md"] - 2),
            "border-radius": px(r["md"]),
            "background-image": css_linear_gradient(gradients_for(scheme)["brand"]),
            "color": css_var("textOnAccent"),
            "box-shadow": SHADOWS["level1"].css() if scheme == "light" else "none",
            "border": "none",
        },
        "button.to-new-conversation:hover": {"filter": "brightness(1.06)"},
        "button.to-new-conversation:active": {"filter": "brightness(0.94)"},
        ".to-shortcut-hint": {"opacity": "0.7"},
        ".to-side-section": {
            "margin": f"{px(s['base'])} {px(s['md'])} {px(s['xs'])} {px(s['lg'])}",
        },
        "list.to-nav-list": {"background": "none"},
        "list.to-nav-list > row": {
            "min-height": px(34),
            "padding": f"0 {px(s['sm'])}",
            "margin": f"{px(1)} {px(s['md'] - 2)}",
            "border-radius": px(r["sm"] + 2),
            "background": "none",
            "color": css_var("textSecondary"),
        },
        "list.to-nav-list > row:hover": {"background-color": css_var("backgroundElement")},
        "list.to-nav-list > row:active": {"background-color": css_var("backgroundSelected")},
        "list.to-nav-list > row:selected": {"background-color": css_var("backgroundSelected"), "color": css_var("text")},
        "list.to-nav-list > row:selected image": {"color": css_var("accentStrong" if scheme == "light" else "accent")},
        ".to-side-row": {
            "margin": f"0 {px(s['md'] - 2)}",
            "border-radius": px(r["sm"] + 2),
        },
        ".to-side-row:hover": {"background-color": css_var("backgroundElement")},
        "button.to-side-row-main": {
            "min-height": px(34),
            "padding": f"0 {px(s['sm'])}",
            "border-radius": px(r["sm"] + 2),
            "background": "none",
            "box-shadow": "none",
            "border": "none",
        },
        "button.to-side-row-main:active": {"background-color": css_var("backgroundSelected")},
        "button.to-side-row-action": {
            "min-width": px(24),
            "min-height": px(24),
            "margin-right": px(s["xs"]),
            "padding": "0",
            "border-radius": px(r["xs"] + 2),
            "background": "none",
            "box-shadow": "none",
            "border": "none",
            "color": css_var("textTertiary"),
        },
        "button.to-side-row-action:hover": {"background-color": css_var("backgroundSelected"), "color": css_var("text")},
        "button.to-side-add": {"opacity": "0"},
        ".to-side-row:hover button.to-side-add, button.to-side-add:focus-visible": {"opacity": "1"},
        ".to-side-running": {
            "min-width": px(18),
            "padding": f"0 {px(s['xs'] + 2)}",
            "border-radius": px(r["full"]),
            "background-color": css_var("infoMuted"),
            "color": css_var("info"),
            "font-weight": "600",
        },
        ".to-side-runs": {"padding": f"{px(s['xxs'])} 0 {px(s['xs'])}"},
        "button.to-side-run": {
            "min-height": px(28),
            "margin-right": px(s["md"] - 2),
            "padding": f"0 {px(s['sm'])}",
            "border-radius": px(r["sm"]),
            "background": "none",
            "box-shadow": "none",
            "border": "none",
        },
        "button.to-side-run:hover": {"background-color": css_var("backgroundElement")},
        "button.to-side-run:hover .to-text-body-small, button.to-side-run.running .to-text-body-small": {
            "color": css_var("text"),
        },
        ".to-side-empty-runs": {"margin-top": px(s["xxs"]), "margin-bottom": px(s["xs"])},
        ".to-side-status": {"margin": f"{px(s['xs'])} {px(s['lg'])}"},
        "button.to-side-link": {
            "margin": f"0 {px(s['md'])}",
            "padding": f"{px(s['xxs'])} {px(s['sm'])}",
            "min-height": px(24),
            "background": "none",
            "box-shadow": "none",
            "color": css_var("accentStrong" if scheme == "light" else "accent"),
            "font-weight": "600",
        },
        "button.to-side-link:hover": {"background-color": css_var("backgroundElement")},
    }


def _composer(scheme: SchemeName) -> RuleSet:
    s, r = SPACING, RADIUS
    return {
        ".to-sidebar-bottom": {"padding": f"{px(s['xs'])} 0 0"},
        ".to-composer": {
            "margin": f"0 {px(s['md'])} {px(s['xs'])}",
            "padding": f"{px(s['sm'])} {px(s['sm'])} {px(s['sm'] - 2)} {px(s['md'] - 2)}",
            "border-radius": px(r["lg"]),
            "background-color": css_var("surfaceElevated"),
            "border": f"{px(BORDER_WIDTH['thin'])} solid {css_var('border')}",
            "box-shadow": SHADOWS["level1"].css() if scheme == "light" else "none",
        },
        ".to-composer:focus-within": {"border-color": css_var("accentStrong" if scheme == "light" else "accent")},
        ".to-composer textview, .to-composer textview > text": {
            "background": "none",
            "color": css_var("text"),
            "font-size": px(13),
        },
        ".to-composer scrolledwindow": {"min-height": px(40)},
        "button.to-composer-send": {
            "min-width": px(30),
            "min-height": px(30),
            "padding": "0",
            "border-radius": px(r["full"]),
            "background-image": css_linear_gradient(gradients_for(scheme)["brand"]),
            "color": css_var("textOnAccent"),
            "box-shadow": "none",
            "border": "none",
        },
        "button.to-composer-send:disabled": {
            "background-image": "none",
            "background-color": css_var("backgroundSelected"),
            "color": css_var("textTertiary"),
            "filter": "none",
        },
        "dropdown.to-composer-project > button": {
            "min-height": px(26),
            "padding": f"0 {px(s['xs'] + 2)}",
            "border-radius": px(r["sm"]),
            "background": "none",
            "box-shadow": "none",
            "border": "none",
            "color": css_var("textSecondary"),
        },
        "dropdown.to-composer-project > button:hover": {"background-color": css_var("backgroundElement")},
        "dropdown.to-composer-project > button label": {"font-size": px(12)},
        "button.to-sidebar-status": {
            "margin": f"0 {px(s['sm'])} {px(s['sm'])}",
            "padding": f"{px(s['sm'])} {px(s['sm'] + 2)}",
            "border-radius": px(r["md"]),
            "background": "none",
            "box-shadow": "none",
            "border": "none",
        },
        "button.to-sidebar-status:hover": {"background-color": css_var("backgroundElement")},
    }


def _banner(scheme: SchemeName) -> RuleSet:
    rules: RuleSet = {
        "banner.to-banner > revealer > widget": {
            "margin": "0",
            "border-radius": "0",
            "padding": f"{px(SPACING['xs'])} {px(SPACING['md'])}",
            "background-color": css_var("backgroundElement"),
            "color": css_var("text"),
            "box-shadow": f"inset 0 -1px {css_var('border')}",
        },
        "banner.to-banner > revealer > widget button": {
            "border-radius": px(RADIUS["full"]),
            "padding": f"0 {px(SPACING['md'])}",
        },
    }
    for tone, (muted, solid) in {
        "danger": ("dangerMuted", "danger"),
        "warning": ("warningMuted", "warning"),
        "info": ("infoMuted", "info"),
    }.items():
        rules[f"banner.to-banner.tone-{tone} > revealer > widget"] = {"background-color": css_var(muted)}
        rules[f"banner.to-banner.tone-{tone} > revealer > widget button"] = {
            "background-color": css_var(solid),
            "color": css_var("textInverse"),
        }
    return rules


def _user_css_shield() -> RuleSet:
    card_radius = px(RADIUS["md"])
    return {
        "window.background": {"background-color": "var(--window-bg-color)"},
        "window.to-main-window": {"font-size": px(BASE_FONT_SIZE)},
        "list.boxed-list": {"background-color": "var(--card-bg-color)", "border-radius": card_radius},
        "list.boxed-list row": {
            "background-color": "transparent",
            "border-radius": "0",
            "margin": "0",
        },
        "list.boxed-list > row": {
            "border-style": "none none solid none",
            "border-width": f"0 0 {px(BORDER_WIDTH['thin'])} 0",
            "border-color": "var(--card-shade-color)",
        },
        "list.boxed-list > row:first-child": {
            "border-top-left-radius": card_radius,
            "border-top-right-radius": card_radius,
        },
        "list.boxed-list > row:last-child": {
            "border-bottom-left-radius": card_radius,
            "border-bottom-right-radius": card_radius,
            "border-bottom-width": "0",
        },
        "list.boxed-list > row.activatable:hover": {
            "background-color": "color-mix(in srgb, currentColor 3%, transparent)",
        },
        "list.boxed-list > row.activatable:active": {
            "background-color": "color-mix(in srgb, currentColor 8%, transparent)",
        },
        "list.boxed-list > row.button.suggested-action": {
            "background-color": "var(--accent-bg-color)",
            "color": "var(--accent-fg-color)",
            "border-bottom-width": "0",
        },
        "list.boxed-list > row.button.suggested-action:hover": {
            "background-color": "var(--accent-bg-color)",
            "background-image": "image(color-mix(in srgb, currentColor 10%, transparent))",
        },
    }


def rules(scheme: SchemeName) -> RuleSet:
    merged: RuleSet = {}
    for part in (_user_css_shield(), _titlebar(scheme), _sidebar(scheme), _composer(scheme), _banner(scheme)):
        merged.update(part)
    return merged
