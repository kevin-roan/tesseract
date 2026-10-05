import type { ChartLegendItem } from "@/components/chart-legend";
import type { SegmentedOption } from "@/components/segmented-pills";
import type { ChartDash, ChartSeries, ChartThreshold } from "@/components/time-series-chart";
import { percentLabel } from "@/lib/progress";
import type { ChartPalette, ChartSeriesName } from "@/theme";

import { seriesPoints, seriesStats, type MetricKey, type MetricSample } from "./metrics";

export type HistoryRange = "5m" | "15m" | "1h";

type HistorySeriesSpec = {
  key: MetricKey;
  label: string;
  color: ChartSeriesName;
  fill?: boolean;
  dash?: ChartDash;
  hidden?: boolean;
};

export const HISTORY_RANGES: readonly (SegmentedOption<HistoryRange> & { ms: number })[] = [
  { value: "5m", label: "5 min", accessibilityLabel: "Last 5 minutes", ms: 5 * 60_000 },
  { value: "15m", label: "15 min", accessibilityLabel: "Last 15 minutes", ms: 15 * 60_000 },
  { value: "1h", label: "1 h", accessibilityLabel: "Last hour", ms: 60 * 60_000 },
];

export const DEFAULT_HISTORY_RANGE: HistoryRange = "15m";
export const LOAD_WARNING = 0.85;

export const HISTORY_COPY = {
  title: "Resource history",
  subtitle: "Share of capacity over time · CPU is load average per core",
  collecting: "Collecting data…",
  now: "now",
  missing: "—",
} as const;

const HISTORY_SERIES: readonly HistorySeriesSpec[] = [
  { key: "load1", label: "CPU load", color: "indigo", fill: true },
  { key: "memory", label: "Memory", color: "teal" },
  { key: "disk", label: "Disk", color: "coral" },
  { key: "load5", label: "5m load", color: "indigo", dash: "dash", hidden: true },
  { key: "load15", label: "15m load", color: "indigo", dash: "dot", hidden: true },
];

export const defaultHiddenSeries = (): Set<MetricKey> =>
  new Set(HISTORY_SERIES.filter((spec) => spec.hidden).map((spec) => spec.key));

export const rangeMs = (range: HistoryRange): number =>
  (HISTORY_RANGES.find((option) => option.value === range) ?? HISTORY_RANGES[1]).ms;

export function historySeries(
  samples: readonly MetricSample[],
  hidden: ReadonlySet<MetricKey>,
  palette: ChartPalette,
): ChartSeries[] {
  return HISTORY_SERIES.filter((spec) => !hidden.has(spec.key)).map((spec) => ({
    id: spec.key,
    color: palette.named[spec.color],
    points: seriesPoints(samples, spec.key),
    fill: spec.fill,
    dash: spec.dash,
  }));
}

export function historyLegend(
  samples: readonly MetricSample[],
  start: number,
  hidden: ReadonlySet<MetricKey>,
  palette: ChartPalette,
): ChartLegendItem[] {
  return HISTORY_SERIES.map((spec) => {
    const { current } = seriesStats(samples, spec.key, start);
    return {
      id: spec.key,
      label: spec.label,
      color: palette.named[spec.color],
      value: current === null ? HISTORY_COPY.missing : percentLabel(current),
      dash: spec.dash,
      active: !hidden.has(spec.key),
    };
  });
}

export function historyThreshold(palette: ChartPalette): ChartThreshold {
  return { value: LOAD_WARNING, label: `${percentLabel(LOAD_WARNING)} warning`, color: palette.status.warning };
}

export function historySummary(legend: readonly ChartLegendItem[], range: HistoryRange): string {
  const label = HISTORY_RANGES.find((option) => option.value === range)?.label ?? range;
  const readings = legend.filter((item) => item.active).map((item) => `${item.label} ${item.value}`);
  return `${HISTORY_COPY.title}, last ${label}. ${readings.join(", ")}`;
}
