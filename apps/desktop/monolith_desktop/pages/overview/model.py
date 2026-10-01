from collections.abc import Callable, Sequence
from dataclasses import dataclass

from ...api.types import InboxCounts, SandboxStatus
from ...services.metrics import Sample, series_points, series_stats
from ...store import ConnectionState
from ...util.format import (
    format_bytes,
    format_load,
    format_relative_time,
    format_uptime,
    join_meta,
    pluralize,
    ratio,
    split_bytes,
)
from ...viewmodels import EmptyModel, NoticeModel, StatItem
from ...widgets.charts.legend import LegendItem
from ...widgets.charts.scale import percent_label
from ...widgets.charts.timeseries import ChartSeries, Threshold
from .labels import (
    ATTENTION,
    COUNTS,
    DISPLAY,
    EMPTY,
    FALLBACK_TITLE,
    HISTORY,
    HISTORY_RANGES,
    HISTORY_SERIES,
    RESOURCE,
)

COUNT_ICONS = {
    "projects": "projects",
    "runningProcesses": "processes",
    "activeBuilds": "builds",
    "terminals": "terminal",
    "agentRuns": "agents",
}
COUNT_PAGES = {
    "projects": "projects",
    "runningProcesses": "processes",
    "activeBuilds": "builds",
    "terminals": "terminals",
    "agentRuns": "agents",
}
EMPTY_ICONS = {
    "unconfigured": "sandbox",
    "offline": "offline",
    "unauthorized": "warning",
    "incompatible": "warning",
}
EMPTY_ACTIONS = {
    "Discover": "rediscover",
    "Rediscover": "rediscover",
    "Retry": "retry",
    "Preferences": "preferences",
}
LOAD_WARNING = 0.85
HISTORY_RANGE_S = {"5m": 300.0, "15m": 900.0, "1h": 3600.0}
DEFAULT_RANGE = "15m"
CHART_HEIGHT = 240


@dataclass(frozen=True)
class SeriesSpec:
    key: str
    color: int
    fill: bool = False
    dash: tuple[float, ...] = ()
    visible: bool = True
    compact: bool = False


SERIES_SPECS = (
    SeriesSpec("load1", 0, fill=True),
    SeriesSpec("memory", 1),
    SeriesSpec("disk", 2),
    SeriesSpec("load5", 0, dash=(6.0, 5.0), visible=False, compact=True),
    SeriesSpec("load15", 0, dash=(0.1, 5.0), visible=False, compact=True),
)


def title(status: SandboxStatus | None, state: ConnectionState) -> str:
    if status:
        return status["sandboxId"]
    return state.sandbox_name or FALLBACK_TITLE


def subtitle(status: SandboxStatus | None) -> str | None:
    if not status:
        return None
    return join_meta(f"up {format_uptime(status['uptimeSec'])}", status["hostname"], f"v{status['version']}")


def load_fraction(status: SandboxStatus) -> float:
    cpu = status["resources"]["cpu"]
    return ratio(cpu["load1"], max(1, cpu["cores"])) or 0.0


def resource_items(status: SandboxStatus) -> list[StatItem]:
    cpu = status["resources"]["cpu"]
    memory = status["resources"]["memory"]
    disk = status["resources"]["disk"]
    mem_value, mem_unit = split_bytes(memory["usedBytes"])
    disk_value, disk_unit = split_bytes(disk["usedBytes"])
    return [
        StatItem(
            "cpu", "cpu", RESOURCE["cpu"], format_load(cpu["load1"]), RESOURCE["cpu_unit"], load_fraction(status),
            "indigo" if load_fraction(status) < LOAD_WARNING else "violet",
            RESOURCE["cpu_caption"].format(cores=cpu["cores"], load5=format_load(cpu["load5"]), load15=format_load(cpu["load15"])),
        ),
        StatItem(
            "memory", "memory", RESOURCE["memory"], mem_value, mem_unit, ratio(memory["usedBytes"], memory["totalBytes"]),
            caption=RESOURCE["memory_caption"].format(total=format_bytes(memory["totalBytes"])),
        ),
        StatItem(
            "disk", "disk", RESOURCE["disk"], disk_value, disk_unit, ratio(disk["usedBytes"], disk["totalBytes"]),
            caption=RESOURCE["disk_caption"].format(total=format_bytes(disk["totalBytes"]), path=disk["path"]),
        ),
        StatItem(
            "uptime", "uptime", RESOURCE["uptime"], format_uptime(status["uptimeSec"]), tone="yellow",
            caption=RESOURCE["uptime_caption"].format(started=format_relative_time(status["startedAt"])),
        ),
    ]


def count_items(status: SandboxStatus, navigate: Callable[[str], None] | None = None) -> list[StatItem]:
    counts = status["counts"]
    return [
        StatItem(
            key,
            COUNT_ICONS[key],
            label,
            str(counts.get(key, 0)),
            on_activate=(lambda page=COUNT_PAGES[key]: navigate(page)) if navigate else None,
        )
        for key, label in COUNTS.items()
    ]


def display_rows(status: SandboxStatus) -> list[tuple[str, str]]:
    display = status["display"]
    vnc = display["vnc"]
    resolution = (
        f"{display['width']}×{display['height']}" if display.get("width") and display.get("height") else DISPLAY["unknown"]
    )
    availability = DISPLAY["available"] if display["available"] else DISPLAY["unavailable"]
    vnc_state = DISPLAY["available"] if vnc["available"] else DISPLAY["unavailable"]
    return [
        (DISPLAY["display"], f"{display['display']} · {availability}"),
        (DISPLAY["resolution"], resolution),
        (DISPLAY["vnc"], DISPLAY["vnc_value"].format(port=vnc["port"], state=vnc_state)),
    ]


def tool_rows(status: SandboxStatus) -> list[tuple[str, str]]:
    return [(tool["name"], tool["version"] or DISPLAY["missing"]) for tool in status.get("tools", [])]


def empty_model(state: ConnectionState) -> EmptyModel | None:
    template = EMPTY.get(state.status)
    if template is None:
        return None
    heading, message, action, secondary = template
    return EmptyModel(
        heading,
        message.format(error=state.error_message or ""),
        EMPTY_ICONS.get(state.status),
        state.status in ("discovering", "connecting"),
        action,
        EMPTY_ACTIONS.get(action or ""),
        secondary,
        EMPTY_ACTIONS.get(secondary or ""),
    )


def attention_notice(inbox: InboxCounts) -> NoticeModel | None:
    count = inbox.get("attentionCount", 0)
    if not count:
        return None
    return NoticeModel(
        ATTENTION["message"].format(count=pluralize(count, ATTENTION["session"])),
        ATTENTION["title"],
        "warning",
        ATTENTION["action"],
        "inbox",
    )


def range_options() -> list[tuple[str, str]]:
    return list(HISTORY_RANGES.items())


def range_seconds(range_id: str) -> float:
    return HISTORY_RANGE_S.get(range_id, HISTORY_RANGE_S[DEFAULT_RANGE])


def legend_items() -> list[LegendItem]:
    return [LegendItem(s.key, HISTORY_SERIES[s.key], s.color, s.dash, s.visible, s.compact) for s in SERIES_SPECS]


def default_hidden() -> set[str]:
    return {s.key for s in SERIES_SPECS if not s.visible}


def chart_series(samples: Sequence[Sample]) -> list[ChartSeries]:
    return [
        ChartSeries(s.key, HISTORY_SERIES[s.key], s.color, tuple(series_points(samples, s.key)), s.fill, s.dash)
        for s in SERIES_SPECS
    ]


def load_threshold() -> Threshold:
    return Threshold(LOAD_WARNING, HISTORY["threshold"].format(value=percent_label(LOAD_WARNING)))


def series_summaries(samples: Sequence[Sample], start: float) -> dict[str, tuple[str, str]]:
    summaries = {}
    for spec in SERIES_SPECS:
        stats = series_stats(samples, spec.key, start)
        if stats.current is None:
            summaries[spec.key] = (HISTORY["missing"], HISTORY["stats_empty"])
            continue
        caption = HISTORY["stats"].format(average=percent_label(stats.average), peak=percent_label(stats.peak))
        summaries[spec.key] = (percent_label(stats.current), caption)
    return summaries
