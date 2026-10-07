import { useCallback, useMemo, useState } from "react";
import { useMetricsHistory } from "../../../app/connection";
import { DEFAULT_RANGE, type HistoryRange } from "../constants";
import { chartSeries, defaultHidden, legendItems, loadThreshold, rangeOptions, rangeSeconds, seriesSummaries } from "../model";

export function useResourceHistory() {
  const { history, revision } = useMetricsHistory();
  const [range, setRange] = useState<HistoryRange>(DEFAULT_RANGE);
  const [hidden, setHidden] = useState<string[]>(defaultHidden);
  const durationS = rangeSeconds(range);
  const samples = useMemo(() => [...history.samples], [history, revision]);
  const series = useMemo(() => chartSeries(samples), [samples]);
  const legend = useMemo(() => legendItems(seriesSummaries(samples, history.now() - durationS)), [samples, history, durationS]);
  const clock = useCallback(() => history.now(), [history]);
  return {
    range,
    setRange,
    ranges: useMemo(rangeOptions, []),
    hidden,
    setHidden,
    durationS,
    series,
    legend,
    clock,
    threshold: useMemo(loadThreshold, []),
  };
}
