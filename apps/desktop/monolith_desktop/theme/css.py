import re
from collections.abc import Iterable

from .chart import chart_for
from .extras import extra_rules
from .semantic import COLORS, SchemeName, look_for
from .surfaces import SURFACE_TONES, surfaces_for
from .tokens import BORDER_WIDTH, CHART_MOTION, CONTROL_HEIGHT, ICON_SIZE, SHADOWS, SPACING, radius_for
from .tone import TONE_COLORS, TONES
from .typography import (
    DESKTOP_FONT_SCALE,
    DISPLAY_STACK,
    MONO_STACK,
    SANS_STACK,
    TEXT_VARIANTS,
    font_stack,
    installed_first,
)

PREFIX = "to"
PX_VALUE = re.compile(r"(?<![\w.#-])(-?\d+(?:\.\d+)?)px\b")


def kebab(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z0-9])", "-", name).lower()


def var_name(color: str) -> str:
    return f"--{PREFIX}-{kebab(color)}"


def css_var(color: str) -> str:
    return f"var({var_name(color)})"


def _px(value: float) -> str:
    rounded = round(value, 2)
    return f"{int(rounded)}px" if rounded == int(rounded) else f"{rounded}px"


def scale_css(css: str, factor: float) -> str:
    if factor == 1:
        return css
    return PX_VALUE.sub(lambda match: _px(float(match.group(1)) * factor), css)


def _block(selector: str, props: dict[str, str]) -> str:
    body = "".join(f"  {key}: {value};\n" for key, value in props.items())
    return f"{selector} {{\n{body}}}\n"


def _root_block(scheme: SchemeName, sans: str, mono: str) -> str:
    c = COLORS[scheme]
    chart = chart_for(scheme)
    props = {var_name(key): value for key, value in c.items()}
    for index, value in enumerate(chart.categorical):
        props[f"--{PREFIX}-chart-{index}"] = value
    props[f"--{PREFIX}-chart-grid"] = chart.grid
    props[f"--{PREFIX}-font-sans"] = sans
    props[f"--{PREFIX}-font-mono"] = mono
    props.update({
        "--accent-bg-color": c["accent"],
        "--accent-fg-color": c["textOnAccent"],
        "--accent-color": c["accentStrong"],
        "--window-bg-color": c["background"],
        "--window-fg-color": c["text"],
        "--view-bg-color": c["surface"],
        "--view-fg-color": c["text"],
        "--headerbar-bg-color": c["background"],
        "--headerbar-fg-color": c["text"],
        "--headerbar-backdrop-color": c["background"],
        "--sidebar-bg-color": c["surfaceSunken"],
        "--sidebar-fg-color": c["text"],
        "--sidebar-backdrop-color": c["surfaceSunken"],
        "--secondary-sidebar-bg-color": c["surfaceSunken"],
        "--card-bg-color": c["surfaceElevated"],
        "--card-fg-color": c["text"],
        "--dialog-bg-color": c["background"],
        "--popover-bg-color": c["surfaceElevated"],
        "--popover-fg-color": c["text"],
        "--success-bg-color": c["successSolid"],
        "--success-color": c["success"],
        "--warning-bg-color": c["warningSolid"],
        "--warning-color": c["warning"],
        "--error-bg-color": c["dangerSolid"],
        "--error-color": c["danger"],
        "--destructive-bg-color": c["dangerSolid"],
        "--destructive-color": c["danger"],
        "--monospace-font-family": mono,
    })
    return _block(":root", props)


DISPLAY_SELECTORS = (
    "headerbar .title", "windowtitle .title", ".title-1", ".title-2", ".title-3", ".title-4", ".large-title",
    ".numeric",
)


def _typography(sans: str, display: str, mono: str) -> str:
    out = [
        _block(":root", {f"--{PREFIX}-font-display": display}),
        _block("window, dialog, popover", {"font-family": sans}),
    ]
    for name, v in TEXT_VARIANTS.items():
        props = {
            "font-size": _px(v.size * DESKTOP_FONT_SCALE),
            "font-weight": str(v.weight),
            # Pango scales a unitless line-height by the font's own (already loose) line height, not its size.
            "line-height": _px(round(v.line_height * DESKTOP_FONT_SCALE, 2)),
            "font-family": mono if v.mono else display if v.display else sans,
        }
        if v.letter_spacing:
            props["letter-spacing"] = _px(v.letter_spacing * DESKTOP_FONT_SCALE)
        if v.uppercase:
            props["text-transform"] = "uppercase"
        if v.tabular:
            props["font-feature-settings"] = '"tnum"'
        out.append(_block(f".{PREFIX}-text-{kebab(name)}", props))
    out.append(_block(", ".join(DISPLAY_SELECTORS), {"font-family": display}))
    return "".join(out)


def _color_classes(scheme: SchemeName) -> str:
    out = []
    for key in COLORS[scheme]:
        out.append(_block(f".{PREFIX}-fg-{kebab(key)}", {"color": css_var(key)}))
        out.append(_block(f".{PREFIX}-bg-{kebab(key)}", {"background-color": css_var(key)}))
    return "".join(out)


def _chart_classes(scheme: SchemeName) -> str:
    return "".join(
        _block(f".{PREFIX}-chart-{index}", {"color": f"var(--{PREFIX}-chart-{index})"})
        for index in range(len(chart_for(scheme).categorical))
    )


def _surfaces(scheme: SchemeName) -> str:
    out = [_block(f".{PREFIX}-surface", {
        "border-radius": _px(radius_for(scheme)["card"]),
        "border": f"{_px(BORDER_WIDTH['thin'])} solid transparent",
    })]
    for tone in SURFACE_TONES:
        style = surfaces_for(scheme)[tone]
        f = style.fill
        gradient = (
            f"radial-gradient(ellipse {round(f.r * 100)}% {round(f.r * 100)}% at {round(f.cx * 100)}% {round(f.cy * 100)}%, "
            f"{f.inner} 0%, {f.outer} 100%)"
        )
        out.append(_block(f".{PREFIX}-surface.surface-{tone}", {
            "background-color": f.outer,
            "background-image": gradient,
            "border-color": style.border,
            "color": style.ink.get("text", css_var("text")),
        }))
        if style.ink:
            scope = f".{PREFIX}-surface.surface-{tone}"
            out.append(_block(scope, {var_name(key): value for key, value in style.ink.items()}))
    return "".join(out)


def _tones() -> str:
    out = []
    for tone in TONES:
        t = TONE_COLORS[tone]
        out.append(_block(f".{PREFIX}-tone-fg.tone-{tone}", {"color": css_var(t.foreground)}))
        out.append(_block(f".{PREFIX}-tone-bg.tone-{tone}", {"background-color": css_var(t.background)}))
        out.append(_block(f".{PREFIX}-tone-dot.tone-{tone}", {"background-color": css_var(t.foreground)}))
        out.append(_block(f".{PREFIX}-progress-fill.tone-{tone}", {"background-color": css_var(t.foreground)}))
    return "".join(out)


def _adwaita(scheme: SchemeName) -> str:
    s, r = SPACING, radius_for(scheme)
    hairline = f"{_px(BORDER_WIDTH['thin'])} solid"
    rules = {
        "window, dialog, popover": {"font-size": _px(13)},
        "image, button image, menubutton image": {"-gtk-icon-size": _px(ICON_SIZE["sm"])},
        **{f"image.{PREFIX}-icon-{size}": {"-gtk-icon-size": _px(value)} for size, value in ICON_SIZE.items()},
        "button": {
            "min-height": _px(CONTROL_HEIGHT["sm"]),
            "padding": f"0 {_px(s['sm'] + 2)}",
            "border-radius": _px(r["sm"]),
            "font-weight": "500",
        },
        "button.flat, button.image-button.flat": {"background": "none", "box-shadow": "none"},
        "button.flat:hover": {"background": css_var("backgroundElement")},
        "button.flat:active, button.flat:checked": {"background": css_var("backgroundSelected")},
        "button.image-button": {"min-width": _px(CONTROL_HEIGHT["sm"]), "padding": "0"},
        "button.text-button:not(.flat):not(.suggested-action):not(.destructive-action), button.image-button:not(.flat):not(.suggested-action):not(.destructive-action)": {
            "background": css_var("surfaceElevated"),
            "border": f"{hairline} {css_var('border')}",
            "box-shadow": "none",
            "color": css_var("text"),
        },
        "button.text-button:not(.flat):not(.suggested-action):not(.destructive-action):hover, button.image-button:not(.flat):not(.suggested-action):not(.destructive-action):hover": {
            "background": css_var("backgroundElement"),
            "border-color": css_var("borderStrong"),
        },
        "button.suggested-action": {
            "background": css_var("accent"),
            "color": css_var("textOnAccent"),
            "box-shadow": "none",
        },
        "button.suggested-action:hover": {"background": "#6C78E6" if look_for(scheme) == "graphite" else css_var("accentPressed")},
        "button.suggested-action:active": {"background": css_var("accentPressed")},
        "button.destructive-action": {"background": css_var("dangerSolid"), "color": "#ffffff", "box-shadow": "none"},
        "button.pill": {"border-radius": _px(r["sm"]), "padding": f"0 {_px(s['base'])}", "min-height": _px(CONTROL_HEIGHT["md"])},
        "button.circular": {"border-radius": _px(r["full"])},
        "button:focus-visible, entry:focus-within, text:focus-visible": {
            "outline": f"{_px(1)} solid {css_var('focusRing')}",
            "outline-offset": _px(1),
        },
        "entry, spinbutton, dropdown > button": {
            "min-height": _px(CONTROL_HEIGHT["md"]),
            "border-radius": _px(r["sm"]),
            "background": css_var("surfaceElevated"),
            "border": f"{hairline} {css_var('border')}",
            "box-shadow": "none",
        },
        "entry:focus-within": {"border-color": css_var("accent")},
        "entry > text > placeholder, text > placeholder": {"color": css_var("textTertiary")},
        "popover > contents, popover.menu > contents": {
            "padding": _px(s["xs"]),
            "border-radius": _px(r["md"]),
            "background": css_var("surfaceElevated"),
            "border": f"{hairline} {css_var('border')}",
            "box-shadow": SHADOWS["level3"].css(),
        },
        "popover.menu modelbutton, popover.menu contents > list > row": {
            "min-height": _px(CONTROL_HEIGHT["sm"]),
            "padding": f"0 {_px(s['sm'])}",
            "border-radius": _px(r["xs"]),
        },
        "popover.menu modelbutton:hover, popover.menu modelbutton:selected": {"background": css_var("backgroundSelected")},
        "popover.menu separator": {"margin": f"{_px(s['xs'])} 0", "background": css_var("divider")},
        "floating-sheet > sheet, dialog.floating > sheet, window.dialog, dialog > widget > sheet": {
            "border-radius": _px(r["xl"]),
            "background": css_var("surfaceElevated"),
            "border": f"{hairline} {css_var('border')}",
            "box-shadow": SHADOWS["level4"].css(),
        },
        "dialog-host > dimming, floating-sheet > dimming": {"background": css_var("overlay")},
        "dialog headerbar, dialog .title": {"font-weight": "500"},
        "switch": {
            "min-width": _px(28), "min-height": _px(16),
            "border-radius": _px(r["full"]),
            "background": css_var("backgroundSelected"),
            "border": "none",
        },
        "switch:checked": {"background": css_var("accent")},
        "switch > slider": {"min-width": _px(12), "min-height": _px(12), "margin": _px(2), "background": "#ffffff", "box-shadow": "none"},
        "check, radio": {
            "min-width": _px(14), "min-height": _px(14),
            "border": f"{hairline} {css_var('borderStrong')}",
            "background": "none",
            "box-shadow": "none",
        },
        "check": {"border-radius": _px(r["xs"])},
        "check:checked, radio:checked": {"background": css_var("accent"), "border-color": css_var("accent"), "color": "#ffffff"},
        "scrollbar slider": {"min-width": _px(6), "min-height": _px(6), "background": "rgba(255, 255, 255, 0.12)"},
        "scrollbar slider:hover": {"background": "rgba(255, 255, 255, 0.22)"},
        "tooltip": {
            "padding": f"{_px(s['xs'])} {_px(s['sm'])}",
            "border-radius": _px(r["sm"]),
            "background": css_var("surfaceElevated"),
            "border": f"{hairline} {css_var('border')}",
            "color": css_var("text"),
            "font-size": _px(12),
            "box-shadow": SHADOWS["level2"].css(),
        },
        "separator": {"background": css_var("divider"), "min-width": _px(1), "min-height": _px(1)},
        "list.boxed-list, .card": {
            "border-radius": _px(r["card"]),
            "background": css_var("surface"),
            "border": f"{hairline} {css_var('border')}",
            "box-shadow": "none",
        },
        "list.boxed-list > row": {"border-color": css_var("divider")},
        "row.activatable:hover": {"background": css_var("backgroundElement")},
        "toast": {
            "border-radius": _px(r["md"]),
            "background": css_var("surfaceElevated"),
            "border": f"{hairline} {css_var('border')}",
            "color": css_var("text"),
            "box-shadow": SHADOWS["level3"].css(),
        },
        "banner > revealer > widget": {"background": css_var("surfaceElevated"), "border-bottom": f"{hairline} {css_var('divider')}"},
        "preferencesgroup > box > label.heading, .heading": {"font-weight": "500"},
        "selection, text selection, label selection": {"background-color": "rgba(94, 106, 210, 0.35)"},
    }
    return "".join(_block(selector, props) for selector, props in rules.items() if props)


def _components(scheme: SchemeName) -> str:
    s, r = SPACING, radius_for(scheme)
    hairline = f"{_px(BORDER_WIDTH['thin'])} solid"
    rules = {
        f".{PREFIX}-page": {"padding": f"{_px(s['xl'])} {_px(s['2xl'])} {_px(s['3xl'])} {_px(s['2xl'])}"},
        f".{PREFIX}-card": {
            "padding": _px(s["base"]),
            "border-radius": _px(r["card"]),
            "box-shadow": "none",
        },
        f".{PREFIX}-card.compact": {"padding": _px(s["md"]), "border-radius": _px(r["md"])},
        f".{PREFIX}-icon-badge": {
            "min-width": _px(28), "min-height": _px(28),
            "border-radius": _px(r["sm"]),
            "background-color": css_var("backgroundElement"),
            "border": f"{hairline} {css_var('border')}",
            "color": css_var("textSecondary"),
        },
        f".{PREFIX}-icon-badge.large": {"min-width": _px(36), "min-height": _px(36), "border-radius": _px(r["md"])},
        f".{PREFIX}-empty-badge": {
            "min-width": _px(56), "min-height": _px(56),
            "border-radius": _px(r["xl"]),
            "background-color": "transparent",
            "border": f"{_px(BORDER_WIDTH['thick'])} solid {css_var('borderStrong')}",
            "color": css_var("textSecondary"),
        },
        f".{PREFIX}-status-badge": {
            "padding": f"0 {_px(s['sm'])}",
            "min-height": _px(20),
            "border-radius": _px(r["full"]),
            "font-size": _px(12),
            "font-weight": "500",
        },
        f".{PREFIX}-status-badge.{PREFIX}-tone-bg": {
            "background-color": "transparent",
            "border": f"{hairline} {css_var('border')}",
        },
        f".{PREFIX}-tone-dot": {"min-width": _px(8), "min-height": _px(8), "border-radius": _px(r["full"])},
        f".{PREFIX}-connection-halo": {"min-width": _px(10), "min-height": _px(10), "border-radius": _px(r["full"])},
        f".{PREFIX}-connection-halo .{PREFIX}-tone-dot": {"min-width": _px(8), "min-height": _px(8)},
        f".{PREFIX}-connection-halo.{PREFIX}-tone-bg": {"background-color": "transparent"},
        f"button.{PREFIX}-chip": {
            "min-height": _px(CONTROL_HEIGHT["sm"]),
            "padding": f"0 {_px(s['md'])}",
            "border-radius": _px(r["pill"]),
            "border": f"{hairline} {css_var('border')}",
            "background": "transparent",
            "color": css_var("textSecondary"),
            "box-shadow": "none",
            "font-weight": "500",
        },
        f"button.{PREFIX}-chip:hover": {"background": css_var("backgroundElement"), "color": css_var("text")},
        f"button.{PREFIX}-chip:checked, button.{PREFIX}-chip.selected": {
            "border-color": css_var("borderStrong"),
            "background": css_var("backgroundSelected"),
            "color": css_var("text"),
        },
        f"button.{PREFIX}-chip:disabled": {"opacity": "0.45"},
        f".{PREFIX}-segmented": {
            "padding": _px(2),
            "border-radius": _px(r["pill"]),
            "border": f"{hairline} {css_var('border')}",
            "background": css_var("surfaceSunken"),
        },
        f"button.{PREFIX}-segment": {
            "min-height": _px(CONTROL_HEIGHT["xs"]),
            "padding": f"0 {_px(s['md'])}",
            "border-radius": _px(r["pill"]),
            "border": "none",
            "background": "transparent",
            "color": css_var("textSecondary"),
            "box-shadow": "none",
        },
        f"button.{PREFIX}-segment:hover": {"color": css_var("text")},
        f"button.{PREFIX}-segment:checked": {"background": css_var("backgroundSelected"), "color": css_var("text")},
        f".{PREFIX}-progress-track": {
            "min-height": _px(4),
            "border-radius": _px(r["full"]),
            "background-color": css_var("backgroundSelected"),
        },
        f".{PREFIX}-progress-fill": {"min-height": _px(4), "border-radius": _px(r["full"])},
        f".{PREFIX}-notice": {
            "padding": f"{_px(s['sm'])} {_px(s['md'])}",
            "border-radius": _px(r["md"]),
            "border": f"{hairline} {css_var('border')}",
        },
        f".{PREFIX}-log-view, .{PREFIX}-log-view > textview, .{PREFIX}-log-view text": {
            "background-color": css_var("codeBackground"),
        },
        f".{PREFIX}-log-view": {"border-radius": _px(r["md"]), "border": f"{hairline} {css_var('border')}"},
        f".{PREFIX}-log-view textview": {"padding": _px(s["md"]), "font-family": css_var("font-mono")},
        f".{PREFIX}-jump-button": {
            "min-width": _px(CONTROL_HEIGHT["sm"]), "min-height": _px(CONTROL_HEIGHT["sm"]),
            "border-radius": _px(r["full"]),
            "background": css_var("surfaceElevated"),
            "border": f"{hairline} {css_var('borderStrong')}",
            "color": css_var("text"),
            "box-shadow": SHADOWS["level2"].css(),
        },
        f".{PREFIX}-avatar": {
            "border-radius": _px(r["full"]),
            "background-color": css_var("backgroundSelected"),
            "color": css_var("text"),
            "font-size": _px(10),
            "font-weight": "600",
        },
        f".{PREFIX}-key-value": {"padding": f"{_px(s['xs'])} 0"},
        f".{PREFIX}-sidebar-badge": {
            "min-width": _px(16),
            "min-height": _px(16),
            "padding": f"0 {_px(s['xs'])}",
            "border-radius": _px(r["full"]),
            "background-color": css_var("backgroundSelected"),
            "color": css_var("textSecondary"),
            "font-size": _px(11),
            "font-weight": "500",
        },
        f"button.{PREFIX}-primary": {
            "min-height": _px(CONTROL_HEIGHT["sm"]),
            "background": css_var("accent"),
            "color": css_var("textOnAccent"),
            "border-radius": _px(r["pill"]),
            "border": "none",
            "padding": f"0 {_px(s['md'] + 2)}",
            "font-weight": "500",
            "box-shadow": "none",
        },
        f"button.{PREFIX}-primary:hover": {"filter": "brightness(1.1)"},
        f"button.{PREFIX}-primary:active": {"background": css_var("accentPressed")},
        f"button.{PREFIX}-primary:disabled": {"opacity": "0.5"},
        f"button.{PREFIX}-secondary": {
            "min-height": _px(CONTROL_HEIGHT["sm"]),
            "border-radius": _px(r["pill"]),
            "padding": f"0 {_px(s['md'] + 2)}",
            "font-weight": "500",
        },
        f"button.{PREFIX}-secondary:not(:hover):not(:active)": {
            "background": css_var("surfaceElevated"),
            "border": f"{hairline} {css_var('border')}",
            "box-shadow": "none",
        },
        f".{PREFIX}-qr": {
            "padding": _px(s["md"]),
            "border-radius": _px(r["md"]),
            "background-color": "#ffffff",
        },
        f"button.{PREFIX}-pressable": {
            "padding": "0",
            "background": "none",
            "border": "none",
            "border-radius": _px(r["card"]),
            "box-shadow": "none",
        },
        f"button.{PREFIX}-pressable:hover > .{PREFIX}-surface": {"background-color": css_var("backgroundElement"), "background-image": "none"},
        f"button.{PREFIX}-pressable:active > .{PREFIX}-surface": {"background-color": css_var("backgroundSelected"), "background-image": "none"},
        f"button.{PREFIX}-link-button": {"color": css_var("textSecondary"), "padding": f"0 {_px(s['sm'])}"},
        f"button.{PREFIX}-link-button:hover": {"color": css_var("text")},
        f".{PREFIX}-list-row": {"padding": f"{_px(s['sm'])} {_px(s['md'])}", "border-radius": _px(r["sm"])},
        f"row.{PREFIX}-nav-row": {"border-radius": _px(r["sm"]), "padding": f"{_px(s['xs'])} {_px(s['sm'])}"},
        f".{PREFIX}-sidebar-footer": {"padding": _px(s["sm"])},
        f".{PREFIX}-section-title": {"margin-bottom": _px(s["xxs"])},
        f".{PREFIX}-sparkline": {"min-height": _px(32)},
        f".{PREFIX}-brand-mark": {"border-radius": _px(r["sm"])},
    }
    return "".join(_block(selector, props) for selector, props in rules.items() if props)


def _keyframes(name: str, frames: dict[str, dict[str, str]]) -> str:
    body = "".join(_block(stop, props) for stop, props in frames.items())
    return f"@keyframes {PREFIX}-{name} {{\n{body}}}\n"


def _animations() -> str:
    floor = str(CHART_MOTION["pulse_floor"])
    return "".join([
        _keyframes("pulse", {"0%": {"opacity": "1"}, "50%": {"opacity": floor}, "100%": {"opacity": "1"}}),
        _keyframes("shimmer", {"from": {"background-position": "-100% 0"}, "to": {"background-position": "200% 0"}}),
        _keyframes("rise", {
            "from": {"opacity": "0", "transform": "translateY(12px)"},
            "to": {"opacity": "1", "transform": "none"},
        }),
        _keyframes("float", {
            "0%": {"transform": "translateY(0)"},
            "50%": {"transform": "translateY(-5px)"},
            "100%": {"transform": "translateY(0)"},
        }),
        _keyframes("twinkle", {
            "0%": {"-gtk-icon-transform": "scale(1) rotate(0deg)", "opacity": "1"},
            "50%": {"-gtk-icon-transform": "scale(1.18) rotate(12deg)", "opacity": "0.7"},
            "100%": {"-gtk-icon-transform": "scale(1) rotate(0deg)", "opacity": "1"},
        }),
    ])


def generate_css(scheme: SchemeName, installed_fonts: Iterable[str] = ()) -> str:
    installed = set(installed_fonts)
    sans = font_stack(installed_first(SANS_STACK, installed))
    display = font_stack(installed_first(DISPLAY_STACK, installed))
    mono = font_stack(installed_first(MONO_STACK, installed))
    return "".join([
        _root_block(scheme, sans, mono),
        _typography(sans, display, mono),
        _color_classes(scheme),
        _chart_classes(scheme),
        _surfaces(scheme),
        _tones(),
        _adwaita(scheme),
        _components(scheme),
        _animations(),
        "".join(_block(selector, props) for selector, props in extra_rules(scheme).items()),
    ])
