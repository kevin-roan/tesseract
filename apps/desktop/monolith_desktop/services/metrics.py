import atexit
import json
import logging
import math
import os
import time
from collections import deque
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import astuple, dataclass
from pathlib import Path

from ..api.types import SandboxStatus
from ..store import AppStore, ConnectionState, Observable

log = logging.getLogger(__name__)

WINDOW_S = 3600.0
MAX_SAMPLES = 1500
GAP_S = 95.0
SAVE_INTERVAL_S = 30.0
MAX_SANDBOXES = 4
FUTURE_TOLERANCE_S = 60.0
CACHE_VERSION = 1
CACHE_FILE = "metrics.json"
APP_DIR_NAME = "monolith-desktop"
SERIES_KEYS = ("load1", "load5", "load15", "memory", "disk")

Point = tuple[float, float | None]


@dataclass(frozen=True)
class Sample:
    t: float
    cores: float
    load1: float
    load5: float
    load15: float
    mem_used: float
    mem_total: float
    disk_used: float
    disk_total: float
    gap_before: bool = False

    def value(self, key: str) -> float | None:
        if key in ("load1", "load5", "load15"):
            return getattr(self, key) / max(1.0, self.cores)
        if key == "memory":
            return self.mem_used / self.mem_total if self.mem_total > 0 else None
        if key == "disk":
            return self.disk_used / self.disk_total if self.disk_total > 0 else None
        raise KeyError(key)

    def with_gap(self, gap_before: bool) -> "Sample":
        return Sample(*astuple(self)[:-1], gap_before)

    def to_row(self) -> list[float | int]:
        return [*(round(v, 4) for v in astuple(self)[:-1]), int(self.gap_before)]

    @classmethod
    def from_row(cls, row: object) -> "Sample | None":
        if not isinstance(row, list) or len(row) != 10:
            return None
        if not all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in row):
            return None
        if any(v < 0 for v in row[1:9]):
            return None
        return cls(*(float(v) for v in row[:9]), bool(row[9]))


@dataclass(frozen=True)
class SeriesStats:
    current: float | None
    average: float | None
    peak: float | None


def sample_from_status(status: SandboxStatus, t: float) -> Sample | None:
    try:
        resources = status["resources"]
        cpu, memory, disk = resources["cpu"], resources["memory"], resources["disk"]
        values = (
            float(cpu["cores"]), float(cpu["load1"]), float(cpu["load5"]), float(cpu["load15"]),
            float(memory["usedBytes"]), float(memory["totalBytes"]), float(disk["usedBytes"]), float(disk["totalBytes"]),
        )
    except (KeyError, TypeError, ValueError):
        return None
    if not all(math.isfinite(v) and v >= 0 for v in values):
        return None
    return Sample(t, *values)


def in_window(samples: Sequence[Sample], start: float, end: float) -> list[Sample]:
    inside = [s for s in samples if start <= s.t <= end]
    before = [s for s in samples if s.t < start]
    if before and inside and not inside[0].gap_before and inside[0].t - before[-1].t <= GAP_S:
        return [before[-1], *inside]
    return inside


def series_points(samples: Iterable[Sample], key: str) -> list[Point]:
    points: list[Point] = []
    previous: Sample | None = None
    for sample in samples:
        if previous is not None and (sample.gap_before or sample.t - previous.t > GAP_S):
            points.append((sample.t, None))
        value = sample.value(key)
        points.append((sample.t, value))
        previous = sample
    return points


def series_stats(samples: Iterable[Sample], key: str, start: float) -> SeriesStats:
    values = [v for s in samples if s.t >= start and (v := s.value(key)) is not None]
    if not values:
        return SeriesStats(None, None, None)
    return SeriesStats(values[-1], sum(values) / len(values), max(values))


def cache_path(env: Mapping[str, str] = os.environ) -> Path:
    base = env.get("XDG_CACHE_HOME") or str(Path.home() / ".cache")
    return Path(base) / APP_DIR_NAME / CACHE_FILE


def parse_cache(text: str, now: float, window_s: float = WINDOW_S) -> dict[str, list[Sample]]:
    try:
        data = json.loads(text)
    except ValueError:
        return {}
    if not isinstance(data, dict) or data.get("version") != CACHE_VERSION or not isinstance(data.get("sandboxes"), dict):
        return {}
    result: dict[str, list[Sample]] = {}
    for sandbox, rows in data["sandboxes"].items():
        if not isinstance(sandbox, str) or not isinstance(rows, list):
            continue
        samples = sorted(
            (s for row in rows if (s := Sample.from_row(row)) and now - window_s <= s.t <= now + FUTURE_TOLERANCE_S),
            key=lambda s: s.t,
        )
        if samples:
            result[sandbox] = samples[-MAX_SAMPLES:]
    return result


def serialize_cache(sandboxes: Mapping[str, Sequence[Sample]], now: float, window_s: float = WINDOW_S) -> str:
    kept = {
        sandbox: [s.to_row() for s in samples if s.t >= now - window_s][-MAX_SAMPLES:]
        for sandbox, samples in sandboxes.items()
    }
    recent = sorted(
        ((sandbox, rows) for sandbox, rows in kept.items() if rows), key=lambda item: item[1][-1][0], reverse=True
    )[:MAX_SANDBOXES]
    return json.dumps({"version": CACHE_VERSION, "sandboxes": dict(recent)}, separators=(",", ":"))


def write_atomic(path: Path, text: str) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(".tmp")
        temp.write_text(text, "utf-8")
        os.replace(temp, path)
    except OSError as error:
        log.debug("metrics cache not written: %s", error)


def read_cache(path: Path, now: float, window_s: float = WINDOW_S) -> dict[str, list[Sample]]:
    try:
        return parse_cache(path.read_text("utf-8"), now, window_s)
    except (OSError, UnicodeDecodeError):
        return {}


class MetricsHistory:
    def __init__(
        self,
        store: AppStore,
        path: Path | None = None,
        clock: Callable[[], float] = time.time,
        window_s: float = WINDOW_S,
        persist: bool = True,
    ) -> None:
        self.revision: Observable[int] = Observable(0)
        self._clock = clock
        self._window_s = window_s
        self._path = (path or cache_path()) if persist else None
        self._samples: deque[Sample] = deque(maxlen=MAX_SAMPLES)
        self._sandbox: str | None = None
        self._broken = True
        self._last_save = clock()
        self._stored = read_cache(self._path, clock(), window_s) if self._path else {}
        store.connection.subscribe(self._connection_changed)
        store.status.subscribe(self._status_changed)
        if self._path:
            atexit.register(self.save)

    @property
    def sandbox_id(self) -> str | None:
        return self._sandbox

    @property
    def samples(self) -> tuple[Sample, ...]:
        return tuple(self._samples)

    def now(self) -> float:
        return self._clock()

    def slice(self, range_s: float, end: float | None = None) -> list[Sample]:
        end = self._clock() if end is None else end
        return in_window(self._samples, end - range_s, end)

    def record(self, status: SandboxStatus) -> None:
        now = self._clock()
        sample = sample_from_status(status, now)
        if sample is None:
            return
        sandbox = status.get("sandboxId") or ""
        if sandbox != self._sandbox:
            self._switch(sandbox, now)
        while self._samples and self._samples[-1].t >= now:
            self._samples.pop()
            self._broken = True
        self._samples.append(sample.with_gap(self._broken and bool(self._samples)))
        self._broken = False
        self._prune(now)
        self.revision.set(self.revision.value + 1)
        if now - self._last_save >= SAVE_INTERVAL_S:
            self.save()

    def save(self) -> None:
        if not self._path:
            return
        now = self._clock()
        self._last_save = now
        if self._sandbox is not None:
            self._stored[self._sandbox] = list(self._samples)
        write_atomic(self._path, serialize_cache(self._stored, now, self._window_s))

    def _switch(self, sandbox: str, now: float) -> None:
        if self._sandbox is not None:
            self._stored[self._sandbox] = list(self._samples)
        self._sandbox = sandbox
        self._samples.clear()
        self._samples.extend(s for s in self._stored.get(sandbox, ()) if s.t >= now - self._window_s)
        self._broken = True

    def _prune(self, now: float) -> None:
        cutoff = now - self._window_s - GAP_S
        while self._samples and self._samples[0].t < cutoff:
            self._samples.popleft()

    def _connection_changed(self, state: ConnectionState) -> None:
        if not state.online:
            self._broken = True

    def _status_changed(self, status: SandboxStatus | None) -> None:
        if status is None:
            self._broken = True
        else:
            self.record(status)
