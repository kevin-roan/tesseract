import math
import re
import time
from datetime import datetime, timezone

BYTE_UNITS = ("B", "KB", "MB", "GB", "TB", "PB")
MINUTE = 60
HOUR = 60 * MINUTE
DAY = 24 * HOUR
WEEK = 7 * DAY


def _js_fixed(value: float, digits: int) -> str:
    factor = 10**digits
    return f"{math.floor(value * factor + 0.5) / factor:.{digits}f}"


def _trim_decimal(value: float) -> str:
    fixed = _js_fixed(value, 0) if value >= 100 else _js_fixed(value, 1)
    return fixed[:-2] if fixed.endswith(".0") else fixed


def split_bytes(size: float | None) -> tuple[str, str]:
    if size is None or not math.isfinite(size) or size <= 0:
        return "0", "B"
    value = float(size)
    unit = 0
    while value >= 1024 and unit < len(BYTE_UNITS) - 1:
        value /= 1024
        unit += 1
    return (str(round(value)) if unit == 0 else _trim_decimal(value)), BYTE_UNITS[unit]


def format_bytes(size: float | None) -> str:
    value, unit = split_bytes(size)
    return f"{value} {unit}"


def format_uptime(seconds: float) -> str:
    total = max(0, math.floor(seconds))
    if total < MINUTE:
        return f"{total}s"
    if total < HOUR:
        return f"{total // MINUTE}m"
    if total < DAY:
        hours, minutes = total // HOUR, (total % HOUR) // MINUTE
        return f"{hours}h {minutes}m" if minutes else f"{hours}h"
    days, hours = total // DAY, (total % DAY) // HOUR
    return f"{days}d {hours}h" if hours else f"{days}d"


def format_duration(seconds: float) -> str:
    total = max(0, math.floor(seconds + 0.5))
    if total < MINUTE:
        return f"{total}s"
    if total < HOUR:
        rest = total % MINUTE
        return f"{total // MINUTE}m {rest}s" if rest else f"{total // MINUTE}m"
    return format_uptime(total)


def parse_iso(value: str | None) -> float | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()


def now_s() -> float:
    return time.time()


def elapsed_seconds(start_iso: str | None, end_iso: str | None, now: float | None = None) -> float | None:
    start = parse_iso(start_iso)
    if start is None:
        return None
    end = parse_iso(end_iso) if end_iso else (now if now is not None else now_s())
    if end is None:
        return None
    return max(0.0, end - start)


def format_relative_time(iso: str | None, now: float | None = None) -> str:
    moment = parse_iso(iso)
    if moment is None:
        return ""
    seconds = math.floor((now if now is not None else now_s()) - moment)
    if seconds < 45:
        return "just now"
    if seconds < HOUR:
        return f"{max(1, math.floor(seconds / MINUTE + 0.5))}m ago"
    if seconds < DAY:
        return f"{seconds // HOUR}h ago"
    if seconds < WEEK:
        return f"{seconds // DAY}d ago"
    return datetime.fromtimestamp(moment, tz=timezone.utc).strftime("%Y-%m-%d")


def clamp_fraction(value: float | None) -> float:
    if value is None or not math.isfinite(value):
        return 0.0
    return min(1.0, max(0.0, value))


def format_percent(fraction: float | None, digits: int = 0) -> str:
    value = clamp_fraction(fraction) * 100
    return f"{_js_fixed(value, digits)}%"


def ratio(used: float | None, total: float | None) -> float | None:
    if used is None or not total or total <= 0:
        return None
    return clamp_fraction(used / total)


def compact_number(value: float) -> str:
    value = max(0.0, float(value))
    if value < 1000:
        return str(round(value))
    for scale, suffix in ((1e3, "k"), (1e6, "M"), (1e9, "B")):
        text = _trim_decimal(value / scale)
        if float(text) < 1000 or suffix == "B":
            return f"{text}{suffix}"
    return str(round(value))


def format_tokens(count: int | None) -> str | None:
    if count is None:
        return None
    return f"{compact_number(count)} {'token' if count == 1 else 'tokens'}"


def format_load(load: float) -> str:
    return f"{load:.2f}"


def format_count(value: int) -> str:
    return f"{value:,}"


def capitalize(value: str) -> str:
    spaced = re.sub(r"[_-]+", " ", value).strip()
    return spaced[:1].upper() + spaced[1:] if spaced else spaced


def short_sha(sha: str) -> str:
    return sha[:7]


def pluralize(count: int, singular: str, plural: str | None = None) -> str:
    return f"{count} {singular if count == 1 else (plural or singular + 's')}"


def join_meta(*parts: str | None) -> str:
    return " · ".join(part for part in parts if part)
