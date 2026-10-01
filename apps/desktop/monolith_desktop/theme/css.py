import re
from collections.abc import Iterable

from .chart import chart_for
from .extras import extra_rules
from .gradients import css_linear_gradient, gradients_for
from .semantic import COLORS, SchemeName
from .surfaces import SURFACE_TONES, surfaces_for
from .tokens import BORDER_WIDTH, CONTROL_HEIGHT, RADIUS, SHADOWS, SPACING
from .tone import TONE_COLORS, TONES
from .typography import (
    DESKTOP_FONT_SCALE,
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


def _typography(sans: str, mono: str) -> str:
    out = [_block("window, dialog, popover", {"font-family": sans})]
    for name, v in TEXT_VARIANTS.items():
        props = {
            "font-size": _px(v.size * DESKTOP_FONT_SCALE),
            "font-weight": str(v.weight),
            "line-height": f"{round(v.line_height / v.size, 3)}",
        }
        if v.letter_spacing:
            props["letter-spacing"] = _px(v.letter_spacing)
        if v.uppercase:
            props["text-transform"] = "uppercase"
        if v.mono:
            props["font-family"] = mono
        out.append(_block(f".{PREFIX}-text-{kebab(name)}", props))
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
        "border-radius": _px(RADIUS["lg"]),
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


def _components(scheme: SchemeName) -> str:
    s, r = SPACING, RADIUS
    shadow1 = SHADOWS["level1"].css()
    shadow2 = SHADOWS["level2"].css()
    brand = css_linear_gradient(gradients_for(scheme)["brand"])
    rules = {
        f".{PREFIX}-page": {"padding": f"{_px(s['xl'])} {_px(s['2xl'])} {_px(s['4xl'])} {_px(s['2xl'])}"},
        f".{PREFIX}-card": {
            "padding": _px(s["base"]),
            "border-radius": _px(r["xl"]),
            "box-shadow": shadow1 if scheme == "light" else "none",
        },
        f".{PREFIX}-card.compact": {"padding": _px(s["md"]), "border-radius": _px(r["lg"])},
        f".{PREFIX}-icon-badge": {
            "min-width": _px(38), "min-height": _px(38),
            "border-radius": _px(r["md"]),
            "background-color": css_var("surfaceElevated"),
            "color": css_var("text"),
        },
        f".{PREFIX}-icon-badge.large": {"min-width": _px(44), "min-height": _px(44)},
        f".{PREFIX}-empty-badge": {
            "min-width": _px(72), "min-height": _px(72),
            "border-radius": _px(r["xl"]),
            "background-color": css_var("accentMuted"),
            "color": css_var("text"),
        },
        f".{PREFIX}-status-badge": {
            "padding": f"{_px(s['xxs'])} {_px(s['sm'])}",
            "border-radius": _px(r["full"]),
        },
        f".{PREFIX}-tone-dot": {"min-width": _px(6), "min-height": _px(6), "border-radius": _px(r["full"])},
        f".{PREFIX}-connection-halo": {"min-width": _px(12), "min-height": _px(12), "border-radius": _px(r["full"])},
        f".{PREFIX}-connection-halo .{PREFIX}-tone-dot": {"min-width": _px(8), "min-height": _px(8)},
        f"button.{PREFIX}-chip": {
            "min-height": _px(CONTROL_HEIGHT["sm"]),
            "padding": f"0 {_px(s['md'])}",
            "border-radius": _px(r["full"]),
            "border": f"{_px(BORDER_WIDTH['thin'])} solid {css_var('border')}",
            "background": css_var("surfaceElevated"),
            "color": css_var("textSecondary"),
            "box-shadow": "none",
        },
        f"button.{PREFIX}-chip:checked, button.{PREFIX}-chip.selected": {
            "border-color": css_var("accentStrong"),
            "background": css_var("accentMuted"),
            "color": css_var("text"),
        },
        f"button.{PREFIX}-chip:disabled": {"opacity": "0.45"},
        f".{PREFIX}-progress-track": {
            "min-height": _px(6),
            "border-radius": _px(r["full"]),
            "background-color": css_var("backgroundSelected"),
        },
        f".{PREFIX}-progress-fill": {"min-height": _px(6), "border-radius": _px(r["full"])},
        f".{PREFIX}-notice": {"padding": _px(s["md"]), "border-radius": _px(r["lg"])},
        f".{PREFIX}-log-view, .{PREFIX}-log-view > textview, .{PREFIX}-log-view text": {
            "background-color": css_var("codeBackground"),
        },
        f".{PREFIX}-log-view": {"border-radius": _px(r["lg"])},
        f".{PREFIX}-log-view textview": {"padding": _px(s["md"]), "font-family": css_var("font-mono")},
        f".{PREFIX}-jump-button": {
            "min-width": _px(CONTROL_HEIGHT["md"]), "min-height": _px(CONTROL_HEIGHT["md"]),
            "border-radius": _px(r["full"]),
            "background": css_var("accent"),
            "color": css_var("textOnAccent"),
            "box-shadow": shadow2,
        },
        f".{PREFIX}-avatar": {
            "border-radius": _px(r["full"]),
            "background-color": css_var("accentMuted"),
            "color": css_var("textSecondary"),
        },
        f".{PREFIX}-key-value": {"padding": f"{_px(s['xs'])} 0"},
        f".{PREFIX}-sidebar-badge": {
            "min-width": _px(18),
            "padding": f"0 {_px(s['xs'])}",
            "border-radius": _px(r["full"]),
            "background-color": css_var("notification"),
            "color": css_var("textOnNotification"),
            "font-size": _px(11),
            "font-weight": "600",
        },
        f"button.{PREFIX}-primary": {
            "background-image": brand,
            "color": css_var("textOnAccent"),
            "border-radius": _px(r["full"]),
            "padding": f"{_px(s['sm'])} {_px(s['lg'])}",
            "font-weight": "600",
        },
        f"button.{PREFIX}-secondary": {
            "border-radius": _px(r["full"]),
            "padding": f"{_px(s['sm'])} {_px(s['lg'])}",
        },
        f".{PREFIX}-qr": {
            "padding": _px(s["base"]),
            "border-radius": _px(r["xl"]),
            "background-color": "#ffffff",
        },
        f"button.{PREFIX}-pressable": {
            "padding": "0",
            "background": "none",
            "border-radius": _px(r["xl"]),
            "box-shadow": "none",
        },
        f"button.{PREFIX}-pressable:hover > .{PREFIX}-surface": {"opacity": "0.92"},
        f"button.{PREFIX}-pressable:active > .{PREFIX}-surface": {"opacity": "0.85"},
        f"button.{PREFIX}-link-button": {"color": css_var("textSecondary"), "padding": f"{_px(s['xs'])} {_px(s['sm'])}"},
        f".{PREFIX}-list-row": {"padding": _px(s["md"]), "border-radius": _px(r["lg"])},
        f"row.{PREFIX}-nav-row": {"border-radius": _px(r["md"]), "padding": f"{_px(s['xs'])} {_px(s['sm'])}"},
        f".{PREFIX}-sidebar-footer": {"padding": _px(s["md"])},
        f".{PREFIX}-section-title": {"margin-bottom": _px(s["xxs"])},
        f".{PREFIX}-sparkline": {"min-height": _px(36)},
        f".{PREFIX}-brand-mark": {"border-radius": _px(r["md"])},
    }
    return "".join(_block(selector, props) for selector, props in rules.items())


def generate_css(scheme: SchemeName, installed_fonts: Iterable[str] = ()) -> str:
    installed = set(installed_fonts)
    sans = font_stack(installed_first(SANS_STACK, installed))
    mono = font_stack(installed_first(MONO_STACK, installed))
    return "".join([
        _root_block(scheme, sans, mono),
        _typography(sans, mono),
        _color_classes(scheme),
        _chart_classes(scheme),
        _surfaces(scheme),
        _tones(),
        _components(scheme),
        "".join(_block(selector, props) for selector, props in extra_rules(scheme).items()),
    ])
