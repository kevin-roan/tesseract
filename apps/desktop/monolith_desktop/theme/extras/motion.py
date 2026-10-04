from ..css import PREFIX
from ..semantic import SchemeName
from ..tokens import CHART_MOTION, PRESS_SCALE, SHIMMER_CYCLE, easing, transition

FADED = (
    "background", "color", "border-color", "box-shadow", "opacity", "filter",
    "outline-color", "outline-width", "outline-offset", "transform",
)
INTERACTIVE = (
    "button", "modelbutton", "row.activatable", "list.to-nav-list > row", "list.to-convo-list > row",
    "list.to-record-list > row", "tab", "entry", "spinbutton", ".to-card", ".to-surface", ".to-side-row",
    "banner > revealer > widget", ".to-composer",
)
CARD_PRESSES = (
    f"button.{PREFIX}-pressable:active", f"button.{PREFIX}-side-row-main:active", f"button.{PREFIX}-side-run:active",
    f"button.{PREFIX}-sidebar-status:active", f"button.{PREFIX}-new-conversation:active",
)
LIVE_DOTS = (
    f".{PREFIX}-status-badge.live .{PREFIX}-tone-dot",
    f".{PREFIX}-connection-halo.live .{PREFIX}-tone-dot",
    f".{PREFIX}-tone-dot.live",
)


def rules(scheme: SchemeName) -> dict[str, dict[str, str]]:
    return {
        ", ".join(INTERACTIVE): {"transition": transition(*FADED)},
        "button:active": {"transform": f"scale({PRESS_SCALE['control']})"},
        ", ".join(CARD_PRESSES): {"transform": f"scale({PRESS_SCALE['card']})"},
        ", ".join(LIVE_DOTS): {
            "animation": f"{PREFIX}-pulse {CHART_MOTION['pulse']}ms {easing('standard')} infinite",
        },
        f".{PREFIX}-progress-bar.indeterminate": {
            "border-radius": "999px",
            "background-image": "linear-gradient(to right, transparent, currentColor, transparent)",
            "background-size": "40% 100%",
            "background-repeat": "no-repeat",
            "animation": f"{PREFIX}-shimmer {SHIMMER_CYCLE}ms {easing('linear')} infinite",
        },
    }
