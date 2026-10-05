from ..css import css_var
from ..semantic import SchemeName
from ..tokens import BASE_FONT_SIZE, BORDER_WIDTH, CONTROL_HEIGHT, RADIUS, SPACING, WINDOW_CONTROL, radius_for

RuleSet = dict[str, dict[str, str]]


def px(value: float) -> str:
    return f"{value:g}px"


def _titlebar(scheme: SchemeName) -> RuleSet:
    s, r = SPACING, RADIUS
    size = px(WINDOW_CONTROL["size"])
    control = px(CONTROL_HEIGHT["sm"])
    return {
        "headerbar.to-titlebar": {
            "min-height": px(CONTROL_HEIGHT["xl"]),
            "background": "none",
            "box-shadow": "none",
            "color": css_var("text"),
        },
        "headerbar.to-titlebar > windowhandle > box": {
            "padding": f"{px((CONTROL_HEIGHT['xl'] - CONTROL_HEIGHT['sm']) / 2)} {px(s['sm'])} {px((CONTROL_HEIGHT['xl'] - CONTROL_HEIGHT['sm']) / 2)} {px(s['md'])}",
        },
        "headerbar.to-titlebar > windowhandle > box > box.start, headerbar.to-titlebar > windowhandle > box > box.end": {
            "border-spacing": px(s["xxs"]),
        },
        "headerbar.to-page-header": {"box-shadow": f"inset 0 -{px(BORDER_WIDTH['thin'])} {css_var('divider')}"},
        "headerbar.to-titlebar button, headerbar.to-titlebar menubutton > button": {
            "min-width": control,
            "min-height": control,
            "padding": "0",
            "border-radius": px(r["sm"]),
            "background": "none",
            "box-shadow": "none",
            "border": "none",
            "color": css_var("textSecondary"),
        },
        "headerbar.to-titlebar button:hover, headerbar.to-titlebar menubutton > button:hover": {
            "background-color": css_var("backgroundElement"),
            "color": css_var("text"),
        },
        "headerbar.to-titlebar button:checked, headerbar.to-titlebar menubutton > button:checked": {
            "background-color": css_var("backgroundSelected"),
            "color": css_var("text"),
        },
        "headerbar.to-titlebar button.back": {"margin": "0"},
        "headerbar.to-titlebar button.image-button:not(.flat):not(.suggested-action):not(.destructive-action)": {
            "background": "none",
            "border": "none",
            "color": css_var("textSecondary"),
        },
        "headerbar.to-titlebar:backdrop > windowhandle": {"filter": "none"},
        "headerbar.to-titlebar:backdrop .to-header-title, headerbar.to-titlebar:backdrop .to-brand": {"opacity": "0.7"},
        ".to-caret": {"-gtk-icon-size": px(10), "color": css_var("textSecondary")},
        ".to-crumb-separator": {"color": css_var("textTertiary")},
        ".to-titlebar-divider": {
            "min-width": px(BORDER_WIDTH["thin"]),
            "margin": f"{px(s['xs'] + 2)} {px(s['xs'])}",
            "background-color": css_var("divider"),
        },
        "headerbar.to-titlebar button.to-window-control": {
            "min-width": size,
            "min-height": size,
            "padding": "0",
            "border-radius": px(r["sm"]),
            "background": "none",
            "color": css_var("textSecondary"),
            "box-shadow": "none",
            "border": "none",
            "outline-offset": "-2px",
        },
        "headerbar.to-titlebar button.to-window-control:hover": {"background": css_var("backgroundElement"), "color": css_var("text")},
        "headerbar.to-titlebar button.to-window-control:active": {"background": css_var("backgroundSelected"), "color": css_var("text")},
        "headerbar.to-titlebar button.to-window-control.close:hover": {"background": css_var("dangerSolid"), "color": "#ffffff"},
        "headerbar.to-titlebar button.to-window-control.close:active": {"background": css_var("danger"), "color": "#ffffff"},
        "window:backdrop headerbar.to-titlebar button.to-window-control": {"color": css_var("textTertiary")},
    }


def _panel(scheme: SchemeName) -> RuleSet:
    s = SPACING
    gap = px(s["sm"])
    window_bg = css_var("background")
    return {
        ".sidebar-pane.to-sidebar-pane": {"background-color": window_bg, "box-shadow": "none"},
        ".content-pane.to-panel-frame": {"background-color": window_bg, "box-shadow": "none"},
        "navigation-view.to-panel": {
            "margin": f"{gap} {gap} {gap} 0",
            "border-radius": px(radius_for(scheme)["md"]),
            "border": f"{px(BORDER_WIDTH['thin'])} solid {css_var('border')}",
            "background-color": css_var("surface"),
        },
        "navigation-split-view.collapsed navigation-view.to-panel": {"margin-left": gap},
        "navigation-view.to-panel > *": {"background-color": css_var("surface")},
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
            "border-radius": px(radius_for(scheme)["pill"]),
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


def _user_css_shield(scheme: SchemeName) -> RuleSet:
    card_radius = px(radius_for(scheme)["card"])
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


def _shape(scheme: SchemeName) -> RuleSet:
    r = radius_for(scheme)
    sheet, card, pill = px(r["sheet"]), px(r["card"]), px(r["pill"])
    return {
        "floating-sheet > sheet, dialog-host > dialog.alert sheet, window.messagedialog.csd:not(.solid-csd)": {
            "border-radius": sheet,
        },
        "bottom-sheet > sheet": {"border-top-left-radius": sheet, "border-top-right-radius": sheet},
        "popover > contents": {"border-radius": card},
        "popover > contents modelbutton, popover > contents row": {"border-radius": px(r["sm"])},
        "dialog.alert .response-area > button, window.messagedialog .response-area > button": {"border-radius": pill},
        "button.pill, button.suggested-action, button.destructive-action": {"border-radius": pill},
        "entry, spinbutton": {"border-radius": px(r["sm"])},
        ".card": {"border-radius": card},
    }


def _pairing() -> RuleSet:
    s, r = SPACING, RADIUS
    return {
        # The quiet zone around the code: scanners need light padding even on the dark theme.
        ".to-qr": {"background-color": "#ffffff", "padding": px(s["md"]), "border-radius": px(r["md"])},
    }


def _scrollbars() -> RuleSet:
    thickness = px(5)
    slider = "scrollbar slider, scrollbar.overlay-indicator:not(.dragging):not(.hovering) slider"
    return {
        slider: {"margin": px(SPACING["xxs"]), "border": "none"},
        "scrollbar.vertical slider, scrollbar.vertical.overlay-indicator:not(.dragging):not(.hovering) slider": {
            "min-width": thickness,
        },
        "scrollbar.horizontal slider, scrollbar.horizontal.overlay-indicator:not(.dragging):not(.hovering) slider": {
            "min-height": thickness,
        },
    }


def rules(scheme: SchemeName) -> RuleSet:
    merged: RuleSet = {}
    for part in (
        _user_css_shield(scheme), _shape(scheme), _titlebar(scheme), _panel(scheme), _banner(scheme), _pairing(), _scrollbars(),
    ):
        merged.update(part)
    return merged
