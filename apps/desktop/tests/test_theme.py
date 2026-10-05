import re

import pytest

from monolith_desktop.theme import COLORS, SCHEMES, TEXT_VARIANTS, TONE_COLORS, generate_css, kebab, var_name
from monolith_desktop.theme.chart import chart_for
from monolith_desktop.theme.surfaces import SURFACES


def test_schemes_share_keys():
    for scheme in SCHEMES:
        assert set(COLORS[scheme]) == set(COLORS["light"])


def test_graphite_is_rendered_with_the_linear_palette():
    from monolith_desktop.theme.semantic import RENDERED_SCHEME, is_dark, look_for

    graphite = COLORS["graphite"]
    assert RENDERED_SCHEME == "graphite"
    assert is_dark("graphite") and is_dark("dark") and not is_dark("light")
    assert look_for("graphite") == "graphite"
    assert graphite["background"] == "#09090A"
    assert graphite["surface"] == "#121213"
    assert graphite["surfaceElevated"] == "#1A1A1B"
    assert graphite["backgroundSelected"] == "#232325"
    assert graphite["textSecondary"] == "#929294"
    assert graphite["accent"] == "#5E6AD2"
    assert graphite["textOnAccent"] == "#ffffff"
    assert graphite["success"] == "#4CB782"
    assert graphite["danger"] == "#EB5757"


def test_graphite_variants_cover_every_scheme_table():
    from monolith_desktop.theme.gradients import GRADIENTS

    for table in (SURFACES, GRADIENTS):
        assert set(table) == set(SCHEMES)
    assert set(SURFACES["graphite"]) == set(SURFACES["light"])
    assert set(GRADIENTS["light"]) <= set(GRADIENTS["graphite"])
    assert SURFACES["graphite"]["neutral"].fill.inner == "#121213"
    assert chart_for("graphite").bar == "#5E6AD2"
    assert chart_for("graphite").status["success"] == COLORS["graphite"]["successSolid"]


def test_graphite_corners_are_tight():
    from monolith_desktop.theme.tokens import RADIUS, radius_for

    assert radius_for("graphite")["sm"] == 6
    assert radius_for("graphite")["card"] == 10
    assert radius_for("graphite")["sheet"] == 12
    assert radius_for("graphite")["full"] == 999
    assert radius_for("light") is RADIUS


def test_motion_tokens():
    from monolith_desktop.theme.tokens import CHART_MOTION, DURATIONS, PRESS_SCALE, easing, transition

    assert DURATIONS["fast"] == 120 and DURATIONS["normal"] == 180 and DURATIONS["slow"] == 260
    assert PRESS_SCALE == {"card": 0.98, "control": 0.95}
    assert CHART_MOTION["pulse"] == 2880 and CHART_MOTION["pulse_floor"] == 0.35
    assert easing("standard") == "cubic-bezier(0.2, 0, 0, 1)"
    assert transition("opacity") == "opacity 120ms cubic-bezier(0.2, 0, 0, 1)"


def test_graphite_css_has_motion_and_shape():
    css = generate_css("graphite")
    assert "@keyframes to-pulse {" in css and "opacity: 0.35;" in css
    assert "@keyframes to-shimmer {" in css
    assert "120ms cubic-bezier(0.2, 0, 0, 1)" in css
    assert "border-radius: 6px;" in css and "border-radius: 12px;" in css


def test_tone_colors_reference_semantic_names():
    for tone in TONE_COLORS.values():
        for name in (tone.foreground, tone.background, tone.solid):
            assert name in COLORS["light"]


def test_palette_values_match_mobile():
    assert COLORS["light"]["accent"] == "#C8BFF7"
    assert COLORS["light"]["background"] == "#FCFCFB"
    assert COLORS["dark"]["accentMuted"] == "#221C3D"
    assert chart_for("dark").categorical[0] == "#8A7BEB"
    assert SURFACES["light"]["violet"].fill.inner == "#B66FCB"


def test_kebab():
    assert kebab("textSecondary") == "text-secondary"
    assert var_name("backgroundElement") == "--to-background-element"


@pytest.mark.parametrize("scheme", SCHEMES)
def test_css_contains_tokens(scheme):
    css = generate_css(scheme, {"JetBrains Mono"})
    colors = COLORS[scheme]
    assert f"--accent-bg-color: {colors['accent']};" in css
    assert f"--window-bg-color: {colors['background']};" in css
    assert f"--to-text-secondary: {colors['textSecondary']};" in css
    for variant in TEXT_VARIANTS:
        assert f".to-text-{kebab(variant)} {{" in css
    for tone in TONE_COLORS:
        assert f".to-tone-fg.tone-{tone}" in css
    for tone in ("neutral", "violet", "indigo", "yellow"):
        assert f".to-surface.surface-{tone}" in css
    assert '"JetBrains Mono"' in css
    assert css.count("{") == css.count("}")
    assert not re.search(r":\s*;", css)


def test_schemes_differ():
    assert generate_css("light") != generate_css("dark")


def test_scale_css_scales_pixel_lengths_only():
    from monolith_desktop.theme.css import scale_css

    css = ".a { padding: 8px 12px; border: 0.5px solid #10px; margin: -4px; opacity: 0.9; }"
    assert scale_css(css, 1) == css
    assert scale_css(css, 1.5) == ".a { padding: 12px 18px; border: 0.75px solid #10px; margin: -6px; opacity: 0.9; }"


def test_generated_css_scales_with_zoom():
    from monolith_desktop.theme.css import generate_css, scale_css

    assert "font-size: 21px" in scale_css(generate_css("dark"), 1.5)


def test_font_stacks_use_inter():
    from monolith_desktop.theme.typography import DISPLAY_STACK, MONO_STACK, SANS_STACK

    assert (SANS_STACK[0], DISPLAY_STACK[0], MONO_STACK[0]) == ("Inter", "Inter Display", "Geist Mono")
    for variant in ("display", "title", "h1", "h3", "metric"):
        assert TEXT_VARIANTS[variant].display
    for variant in ("body", "bodySmall", "label", "button", "caption", "overline", "code"):
        assert not TEXT_VARIANTS[variant].display
    assert TEXT_VARIANTS["body"].size == 13


def test_css_uses_display_and_mono_faces():
    css = generate_css("dark", {"Inter", "Inter Display", "Geist Mono"})
    assert '--to-font-display: "Inter Display", Inter, sans-serif;' in css
    assert '--monospace-font-family: "Geist Mono", monospace;' in css
    assert re.search(r'\.to-text-h-1 \{[^}]*font-family: "Inter Display", Inter, sans-serif;', css)
    assert re.search(r'\.to-text-body \{[^}]*font-family: Inter, sans-serif;', css)
    assert re.search(r'\.to-text-code \{[^}]*font-family: "Geist Mono", monospace;', css)


def test_bundled_fonts_present():
    from monolith_desktop.theme.fonts import bundled_fonts

    names = {path.stem.split("_")[0] for path in bundled_fonts()}
    assert names == {"Inter", "InterDisplay", "GeistMono"}
