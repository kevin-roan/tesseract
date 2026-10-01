import re

import pytest

from monolith_desktop.theme import COLORS, SCHEMES, TEXT_VARIANTS, TONE_COLORS, generate_css, kebab, var_name
from monolith_desktop.theme.chart import chart_for
from monolith_desktop.theme.surfaces import SURFACES


def test_schemes_share_keys():
    assert set(COLORS["light"]) == set(COLORS["dark"])


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
