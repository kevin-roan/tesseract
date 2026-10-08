from types import MappingProxyType

TITLE = "Overview"
FALLBACK_TITLE = "Sandbox"

RESOURCE = MappingProxyType({
    "cpu": "CPU load",
    "cpu_unit": "load avg",
    "cpu_caption": "{cores} cores · 5m {load5} · 15m {load15}",
    "memory": "Memory",
    "memory_caption": "of {total}",
    "disk": "Disk",
    "disk_caption": "of {total} · {path}",
    "uptime": "Uptime",
    "uptime_caption": "since {started}",
})

COUNTS = MappingProxyType({
    "projects": "Projects",
    "runningProcesses": "Running processes",
    "activeBuilds": "Active builds",
    "terminals": "Terminals",
    "agentRuns": "Claude runs",
})

SECTIONS = MappingProxyType({
    "resources": "Resources",
    "activity": "Activity",
    "display": "Display",
    "tools": "Toolchain",
    "tools_empty": "The controller reported no tools.",
})

DISPLAY = MappingProxyType({
    "display": "X display",
    "resolution": "Resolution",
    "vnc": "VNC",
    "available": "Available",
    "unavailable": "Unavailable",
    "vnc_value": "Port {port} · {state}",
    "unknown": "—",
    "missing": "not installed",
})

EMPTY = MappingProxyType({
    "unconfigured": ("Connect to your sandbox", "Start the stack with `bun run sandbox up`, then discover it or enter its URL and token.", "Discover", "Preferences"),
    "discovering": ("Looking for the sandbox…", "Asking Docker for the running controller.", None, None),
    "connecting": ("Connecting…", "Waiting for the controller to answer.", None, None),
    "offline": ("Sandbox unreachable", "{error}", "Retry", "Preferences"),
    "unauthorized": ("Token rejected", "The controller refused the saved token. Rediscover it or paste a fresh one.", "Rediscover", "Preferences"),
    "incompatible": ("Version mismatch", "{error}", "Preferences", None),
})

ATTENTION = MappingProxyType({
    "title": "Claude needs you",
    "message": "{count} waiting for input or permission.",
    "session": "session",
    "action": "Open Inbox",
})

REFRESH = "Refresh"

HISTORY = MappingProxyType({
    "title": "Resource history",
    "subtitle": "Share of capacity over time · CPU is load average per core",
    "collecting": "Collecting data…",
    "now": "now",
    "missing": "—",
    "threshold": "{value} warning",
    "stats": "avg {average} · peak {peak}",
    "stats_empty": "No samples in range",
})

HISTORY_RANGES = MappingProxyType({"5m": "5 min", "15m": "15 min", "1h": "1 h"})

HISTORY_SERIES = MappingProxyType({
    "load1": "CPU load",
    "memory": "Memory",
    "disk": "Disk",
    "load5": "5m load",
    "load15": "15m load",
})
