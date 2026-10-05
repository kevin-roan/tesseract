from ..css import css_var
from ..semantic import SchemeName
from ..tokens import BORDER_WIDTH, SPACING, radius_for


def _px(value: float) -> str:
    return f"{value}px"


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    s, r = SPACING, radius_for(scheme)
    hairline = f"{_px(BORDER_WIDTH['thin'])} solid"
    return {
        ".to-overview .to-section-title": {"font-size": _px(13), "font-weight": "500", "margin-bottom": "0"},
        ".to-metric-tile": {
            "padding": f"{_px(s['md'])} {_px(s['md'] + 2)}",
            "border": f"{hairline} {css_var('border')}",
            "border-radius": _px(r["card"]),
            "background-color": "transparent",
            "min-height": _px(s["3xl"] + s["2xl"]),
        },
        "button.to-pressable:hover > .to-metric-tile": {"background-color": css_var("backgroundElement")},
        "button.to-pressable:active > .to-metric-tile": {"background-color": css_var("backgroundSelected")},
        ".to-metric-tile .to-progress-bar.to-tone-fg": {"color": css_var("accent")},
        ".to-metric-tile.metric-violet .to-progress-bar.to-tone-fg": {"color": css_var("warning")},
        ".to-stat-grid > flowboxchild, .to-series-legend > flowboxchild": {"padding": "0"},
        ".to-tabular": {"font-feature-settings": '"tnum"'},
        "list.to-flat-rows": {"background": "none", "border-top": f"{hairline} {css_var('divider')}"},
        "list.to-flat-rows > row.to-flat-row": {
            "padding": f"{_px(s['sm'])} {_px(s['xs'])}",
            "border-bottom": f"{hairline} {css_var('divider')}",
            "border-radius": "0",
            "background": "none",
        },
        "list.to-flat-rows > row.to-flat-row:hover": {"background-color": css_var("backgroundElement")},
        ".to-flat-list": {"border-top": f"{hairline} {css_var('divider')}"},
        ".to-flat-list .to-key-value": {
            "padding": f"{_px(s['sm'] + 1)} {_px(s['xxs'])}",
            "border-bottom": f"{hairline} {css_var('divider')}",
        },
    }
