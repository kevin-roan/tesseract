import { useCallback, useMemo, useState } from "react";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useNow } from "@/hooks/use-now";
import { useScreenActive } from "@/hooks/use-screen-active";

import { useResourceHistoryStore } from "../store/resource-history-store";
import { STATUS_REFRESH_INTERVAL_MS } from "../utils/constants";
import { samplesInWindow, type MetricKey, type MetricSample } from "../utils/metrics";
import {
  DEFAULT_HISTORY_RANGE,
  defaultHiddenSeries,
  HISTORY_COPY,
  HISTORY_RANGES,
  historyLegend,
  historySeries,
  historySummary,
  historyThreshold,
  rangeMs,
  type HistoryRange,
} from "../utils/resource-history";
import { useActiveSandbox } from "./use-sandbox-client";

const NO_SAMPLES: MetricSample[] = [];

/** Chart model for the active sandbox's recorded CPU, memory and disk usage. */
export function useResourceHistory() {
  const sandbox = useActiveSandbox();
  const { chart } = useAppTheme();
  const active = useScreenActive();
  const [range, setRange] = useState<HistoryRange>(DEFAULT_HISTORY_RANGE);
  const [hidden, setHidden] = useState<ReadonlySet<MetricKey>>(defaultHiddenSeries);
  const samples = useResourceHistoryStore((state) => (sandbox ? state.samples[sandbox.id] : undefined)) ?? NO_SAMPLES;
  const now = useNow(active, STATUS_REFRESH_INTERVAL_MS);

  const end = Math.max(now, samples.at(-1)?.t ?? 0);
  const start = end - rangeMs(range);
  const visible = useMemo(() => samplesInWindow(samples, start, end), [samples, start, end]);
  const series = useMemo(() => historySeries(visible, hidden, chart), [visible, hidden, chart]);
  const legend = useMemo(() => historyLegend(visible, start, hidden, chart), [visible, start, hidden, chart]);
  const threshold = useMemo(() => historyThreshold(chart), [chart]);

  const toggleSeries = useCallback((id: string) => {
    setHidden((current) => {
      const next = new Set(current);
      const key = id as MetricKey;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return {
    title: HISTORY_COPY.title,
    subtitle: HISTORY_COPY.subtitle,
    ranges: HISTORY_RANGES,
    range,
    setRange,
    legend,
    toggleSeries,
    series,
    start,
    end,
    threshold,
    endLabel: HISTORY_COPY.now,
    emptyLabel: HISTORY_COPY.collecting,
    summary: historySummary(legend, range),
  };
}

export type ResourceHistoryModel = ReturnType<typeof useResourceHistory>;
