import copy
import json

from monolith_desktop.services.metrics import (
    GAP_S,
    MAX_SAMPLES,
    MetricsHistory,
    Sample,
    in_window,
    parse_cache,
    sample_from_status,
    serialize_cache,
    series_points,
    series_stats,
)
from monolith_desktop.store import AppStore, ConnectionState

from test_view_models import STATUS


class Clock:
    def __init__(self, now: float = 10_000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


def status(load1: float = 2.0, sandbox: str = "theone-sandbox", uptime: float = 0.0) -> dict:
    value = copy.deepcopy(STATUS)
    value["sandboxId"] = sandbox
    value["uptimeSec"] = uptime
    value["resources"]["cpu"]["load1"] = load1
    return value


def sample(t: float, load1: float = 1.0, gap: bool = False) -> Sample:
    return Sample(t, 4, load1, 1.0, 0.5, 2.0, 8.0, 25.0, 100.0, gap)


def history(tmp_path=None, clock: Clock | None = None) -> tuple[AppStore, MetricsHistory, Clock]:
    store = AppStore()
    clock = clock or Clock()
    path = tmp_path / "metrics.json" if tmp_path else None
    return store, MetricsHistory(store, path=path, clock=clock, persist=path is not None), clock


def feed(store: AppStore, clock: Clock, seconds: float, load1: float = 2.0) -> None:
    clock.now += seconds
    store.status.set(status(load1, uptime=clock.now))


def test_sample_values_are_fractions_of_capacity():
    item = sample_from_status(status(6.0), 1.0)
    assert item.value("load1") == 1.5
    assert item.value("load5") == 0.25
    assert item.value("memory") == 0.25
    assert item.value("disk") == 0.25


def test_malformed_status_is_ignored():
    broken = status()
    broken["resources"]["memory"]["usedBytes"] = "lots"
    assert sample_from_status(broken, 1.0) is None
    del broken["resources"]["cpu"]
    assert sample_from_status(broken, 1.0) is None


def test_zero_totals_have_no_value():
    item = Sample(0, 0, 1.0, 1.0, 1.0, 0, 0, 0, 0)
    assert item.value("load1") == 1.0
    assert item.value("memory") is None
    assert item.value("disk") is None


def test_records_samples_from_status_updates():
    store, metrics, clock = history()
    for _ in range(3):
        feed(store, clock, 5)
    assert len(metrics.samples) == 3
    assert metrics.revision.value == 3
    assert metrics.sandbox_id == "theone-sandbox"


def test_disconnect_marks_next_sample_as_gap():
    store, metrics, clock = history()
    store.connection.set(ConnectionState("online"))
    feed(store, clock, 5)
    feed(store, clock, 5)
    store.connection.set(ConnectionState("offline"))
    store.connection.set(ConnectionState("online"))
    feed(store, clock, 5)
    assert [s.gap_before for s in metrics.samples] == [False, False, True]


def test_status_reset_marks_gap():
    store, metrics, clock = history()
    feed(store, clock, 5)
    store.status.set(None)
    feed(store, clock, 5)
    assert metrics.samples[-1].gap_before


def test_series_points_break_on_gap_flag_and_long_silence():
    samples = [sample(0), sample(5), sample(10, gap=True), sample(15), sample(15 + GAP_S + 1)]
    points = series_points(samples, "load1")
    breaks = [t for t, v in points if v is None]
    assert breaks == [10, 15 + GAP_S + 1]
    assert len([p for p in points if p[1] is not None]) == 5


def test_window_includes_one_leading_sample_for_continuity():
    samples = [sample(t) for t in range(0, 100, 10)]
    sliced = in_window(samples, 45, 100)
    assert [s.t for s in sliced] == [40, 50, 60, 70, 80, 90]


def test_window_does_not_bridge_a_gap():
    samples = [sample(0), sample(10), sample(50, gap=True), sample(60)]
    assert [s.t for s in in_window(samples, 45, 100)] == [50, 60]


def test_stats_cover_only_the_range():
    samples = [sample(0, 8.0), sample(10, 2.0), sample(20, 4.0)]
    stats = series_stats(samples, "load1", 5)
    assert stats.current == 1.0
    assert stats.average == 0.75
    assert stats.peak == 1.0
    empty = series_stats(samples, "load1", 100)
    assert empty.current is None and empty.average is None and empty.peak is None


def test_old_samples_are_pruned_and_buffer_is_bounded():
    store, metrics, clock = history()
    for _ in range(MAX_SAMPLES + 50):
        feed(store, clock, 5)
    assert len(metrics.samples) <= MAX_SAMPLES
    assert metrics.samples[0].t >= clock.now - 3600 - GAP_S


def test_slice_uses_clock():
    store, metrics, clock = history()
    for _ in range(10):
        feed(store, clock, 60)
    assert len(metrics.slice(300)) == 7


def test_clock_going_backwards_drops_future_samples():
    store, metrics, clock = history()
    feed(store, clock, 5)
    feed(store, clock, 5)
    clock.now -= 7
    store.status.set(status(3.0, uptime=1))
    assert [s.t for s in metrics.samples] == [clock.now]


def test_switching_sandbox_keeps_histories_apart():
    store, metrics, clock = history()
    feed(store, clock, 5)
    feed(store, clock, 5)
    clock.now += 5
    store.status.set(status(sandbox="other"))
    assert len(metrics.samples) == 1
    clock.now += 5
    store.status.set(status(sandbox="theone-sandbox", uptime=123))
    assert len(metrics.samples) == 3
    assert metrics.samples[-1].gap_before


def test_cache_round_trip_restores_recent_history(tmp_path):
    store, metrics, clock = history(tmp_path)
    for _ in range(5):
        feed(store, clock, 5)
    metrics.save()
    restored_store, restored, restored_clock = history(tmp_path, Clock(clock.now + 30))
    feed(restored_store, restored_clock, 5)
    assert len(restored.samples) == 6
    assert restored.samples[-1].gap_before
    assert not any(s.gap_before for s in restored.samples[:-1])


def test_cache_ignores_corrupt_and_stale_data(tmp_path):
    assert parse_cache("{not json", 100) == {}
    assert parse_cache(json.dumps({"version": 99, "sandboxes": {}}), 100) == {}
    assert parse_cache(json.dumps([1, 2]), 100) == {}
    rows = [
        sample(5000).to_row(),
        sample(90).to_row(),
        [1, 2, 3],
        ["x"] * 10,
        [5001, 4, -1, 1, 1, 1, 1, 1, 1, 0],
        [5002, 4, float("nan"), 1, 1, 1, 1, 1, 1, 0],
    ]
    text = json.dumps({"version": 1, "sandboxes": {"a": rows, "b": "nope"}})
    parsed = parse_cache(text, 5100)
    assert list(parsed) == ["a"]
    assert [s.t for s in parsed["a"]] == [5000]
    (tmp_path / "metrics.json").write_bytes(b"\xff\xfe garbage")
    _store, metrics, _clock = history(tmp_path)
    assert metrics.samples == ()


def test_serialized_cache_is_bounded():
    sandboxes = {f"s{i}": [sample(10), sample(2000 + i)] for i in range(10)}
    data = json.loads(serialize_cache(sandboxes, 5000))
    assert len(data["sandboxes"]) == 4
    assert set(data["sandboxes"]) == {"s9", "s8", "s7", "s6"}
    assert all(len(rows) == 1 for rows in data["sandboxes"].values())
