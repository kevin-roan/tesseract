from ..css import css_var
from ..semantic import SchemeName
from ..tokens import BORDER_WIDTH, RADIUS, SPACING


def _px(value: float) -> str:
    return f"{value}px"


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    s, r = SPACING, RADIUS
    hairline = f"{_px(BORDER_WIDTH['thin'])} solid {css_var('border')}"
    return {
        "list.to-record-list": {
            "background-color": css_var("surfaceElevated"),
            "border": hairline,
            "border-radius": _px(r["lg"]),
            "padding": "0",
        },
        "list.to-record-list > row": {
            "padding": "0",
            "border-bottom": hairline,
            "border-radius": "0",
        },
        "list.to-record-list > row:first-child": {"border-top-left-radius": _px(r["lg"]), "border-top-right-radius": _px(r["lg"])},
        "list.to-record-list > row:last-child": {
            "border-bottom": "none",
            "border-bottom-left-radius": _px(r["lg"]),
            "border-bottom-right-radius": _px(r["lg"]),
        },
        "list.to-record-list > row:hover": {"background-color": css_var("backgroundSelected")},
        "list.to-record-list > row:not(.activatable):hover": {"background-color": "transparent"},
        ".to-record-row": {"padding": f"{_px(s['md'])} {_px(s['md'])} {_px(s['md'])} {_px(s['base'])}", "min-height": _px(36)},
        ".to-record-row .to-icon-badge": {"min-width": _px(32), "min-height": _px(32), "border-radius": _px(r["sm"]),
                                          "background-color": css_var("backgroundSelected")},
        ".to-record-code": {
            "min-width": _px(28),
            "padding": f"{_px(s['xxs'])} {_px(s['xs'])}",
            "border-radius": _px(r["xs"]),
            "font-weight": "600",
        },
        ".to-record-row button.to-secondary": {"padding": f"{_px(s['xs'])} {_px(s['md'])}", "min-height": _px(28)},
        "button.to-danger-button": {"color": css_var("danger")},
        "button.to-active-button": {"background-color": css_var("accentMuted"), "color": css_var("accentStrong")},
        ".to-project-surface": {"min-height": _px(150)},
        ".to-project-surface .to-icon-badge": {"background-color": css_var("accentMuted"), "color": css_var("accentStrong")},
        "button.to-pressable:hover > .to-project-surface": {"opacity": "1", "border-color": css_var("borderStrong")},
        "button.to-pressable:focus-visible > .to-project-surface": {"border-color": css_var("focusRing")},
        "button.to-project-ask": {"border-radius": _px(r["full"]), "min-width": _px(34), "min-height": _px(34)},
        "button.to-project-ask:hover": {"background-color": css_var("accentMuted"), "color": css_var("accentStrong")},
        ".to-project-tag": {
            "padding": f"{_px(s['xxs'])} {_px(s['sm'])}",
            "border-radius": _px(r["full"]),
            "border": hairline,
        },
        ".to-project-commit": {"padding-top": _px(s["xxs"])},
        ".to-project-tabs": {"margin-top": _px(s["xs"])},
        "entry.to-project-search, .to-project-search": {"min-height": _px(38), "border-radius": _px(r["full"])},
        ".to-form-body": {"padding": f"{_px(s['base'])} {_px(s['xl'])} {_px(s['xl'])} {_px(s['xl'])}"},
        ".to-form-actions": {"padding": f"{_px(s['md'])} {_px(s['xl'])}"},
        ".to-form-error": {"margin-left": _px(s["xs"])},
        ".to-log-panel": {"margin-top": _px(s["xs"])},
    }
