from monolith_desktop.pages.overview import model
from monolith_desktop.services.metrics import Sample


def sample(t: float, load1: float, gap: bool = False) -> Sample:
    return Sample(t, 4, load1, 1.0, 0.5, 2.0, 8.0, 25.0, 100.0, gap)


def test_chart_series_follow_specs_with_gaps():
    series = model.chart_series([sample(0, 1.0), sample(5, 2.0), sample(10, 3.0, gap=True)])
    assert [s.key for s in series] == [spec.key for spec in model.SERIES_SPECS]
    load = series[0]
    assert load.fill and load.points == ((0, 0.25), (5, 0.5), (10, None), (10, 0.75))


def test_summaries_format_current_average_peak():
    summaries = model.series_summaries([sample(0, 8.0), sample(10, 2.0), sample(20, 4.0)], 5)
    assert summaries["load1"] == ("100%", "avg 75% · peak 100%")
    assert summaries["memory"] == ("25%", "avg 25% · peak 25%")
    assert model.series_summaries([], 0)["disk"][0] == "—"


def test_legend_and_ranges():
    items = model.legend_items()
    assert {item.key for item in items if not item.active} == model.default_hidden()
    assert all(item.compact for item in items if not item.active)
    assert model.range_seconds("1h") == 3600
    assert model.range_seconds("bogus") == model.range_seconds(model.DEFAULT_RANGE)
    assert [option for option, _label in model.range_options()] == list(model.HISTORY_RANGE_S)
