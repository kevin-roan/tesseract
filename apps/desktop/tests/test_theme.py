import re

import pytest

from monolith_desktop.theme import COLORS, SCHEMES, TEXT_VARIANTS, TONE_COLORS, generate_css, kebab, var_name
from monolith_desktop.theme.chart import chart_for
from monolith_desktop.theme.surfaces import SURFACES


def test_schemes_share_keys():
    for scheme in SCHEMES:
        assert set(COLORS[scheme]) == set(COLORS["light"])


def test_graphite_is_rendered_and_matches_mobile():
    from monolith_desktop.theme.semantic import RENDERED_SCHEME, is_dark, look_for

    graphite = COLORS["graphite"]
    assert RENDERED_SCHEME == "graphite"
    assert is_dark("graphite") and is_dark("dark") and not is_dark("light")
    assert look_for("graphite") == "graphite"
    assert graphite["background"] == "#0D0D0D"
    assert graphite["surface"] == "#161616"
    assert graphite["surfaceElevated"] == "#1D1D1D"
    assert graphite["accent"] == "#EDEDED"
    assert graphite["textOnAccent"] == "#0D0D0D"
    assert graphite["backgroundPattern"] == "rgba(237, 237, 237, 0.07)"
    assert graphite["success"] == "#3DD68C"
    assert graphite["danger"] == "#FF6369"


def test_graphite_variants_cover_every_scheme_table():
    from monolith_desktop.theme.gradients import GRADIENTS

    for table in (SURFACES, GRADIENTS):
        assert set(table) == set(SCHEMES)
    assert set(SURFACES["graphite"]) == set(SURFACES["light"])
    assert set(GRADIENTS["light"]) <= set(GRADIENTS["graphite"])
    assert SURFACES["graphite"]["neutral"].fill.inner == "#1D1D1D"
    assert chart_for("graphite").bar == "#EDEDED"
    assert chart_for("graphite").status["success"] == COLORS["graphite"]["successSolid"]


def test_graphite_corners_are_rounded_squares():
    from monolith_desktop.theme.tokens import RADIUS, radius_for

    assert radius_for("graphite")["card"] == 20
    assert radius_for("graphite")["sheet"] == 28
    assert radius_for("graphite")["pill"] == 14
    assert radius_for("graphite")["full"] == 999
    assert radius_for("light") is RADIUS


def test_motion_tokens_match_mobile():
    from monolith_desktop.theme.tokens import CHART_MOTION, DURATIONS, PRESS_SCALE, easing, transition

    assert DURATIONS["fast"] == 140 and DURATIONS["normal"] == 220 and DURATIONS["slow"] == 320
    assert PRESS_SCALE == {"card": 0.98, "control": 0.95}
    assert CHART_MOTION["pulse"] == 2880 and CHART_MOTION["pulse_floor"] == 0.35
    assert easing("standard") == "cubic-bezier(0.2, 0, 0, 1)"
    assert transition("opacity") == "opacity 140ms cubic-bezier(0.2, 0, 0, 1)"


def test_graphite_css_has_canvas_motion_and_shape():
    css = generate_css("graphite")
    assert ".to-canvas {" in css and "background-size: 20px 20px;" in css
    assert "@keyframes to-pulse {" in css and "opacity: 0.35;" in css
    assert "@keyframes to-shimmer {" in css
    assert "transform: scale(0.95);" in css and "transform: scale(0.98);" in css
    assert "140ms cubic-bezier(0.2, 0, 0, 1)" in css
    assert "border-radius: 14px;" in css and "border-radius: 28px;" in css
    assert ".to-canvas {" not in generate_css("light")


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


def test_font_stacks_match_mobile():
    from monolith_desktop.theme.typography import DISPLAY_STACK, MONO_STACK, SANS_STACK

    assert (SANS_STACK[0], DISPLAY_STACK[0], MONO_STACK[0]) == ("Noto Sans", "Exo 2", "Geist Mono")
    for variant in ("display", "title", "h1", "h4", "metric", "button", "overline"):
        assert TEXT_VARIANTS[variant].display
    for variant in ("body", "bodySmall", "label", "caption", "code"):
        assert not TEXT_VARIANTS[variant].display


def test_css_uses_display_and_mono_faces():
    css = generate_css("dark", {"Exo 2", "Noto Sans", "Geist Mono"})
    assert '--to-font-display: "Exo 2", "Noto Sans", sans-serif;' in css
    assert '--monospace-font-family: "Geist Mono", monospace;' in css
    assert re.search(r'\.to-text-h-1 \{[^}]*font-family: "Exo 2", "Noto Sans", sans-serif;', css)
    assert re.search(r'\.to-text-body \{[^}]*font-family: "Noto Sans", sans-serif;', css)
    assert re.search(r'\.to-text-code \{[^}]*font-family: "Geist Mono", monospace;', css)


def test_bundled_fonts_present():
    from monolith_desktop.theme.fonts import bundled_fonts

    names = {path.stem.split("_")[0] for path in bundled_fonts()}
    assert names == {"Exo2", "NotoSans", "GeistMono"}
