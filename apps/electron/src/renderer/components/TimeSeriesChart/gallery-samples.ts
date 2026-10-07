import type { LegendItem } from "../SeriesLegend";
import type { ChartPoint, ChartSeries, ChartThreshold } from "./types";

export const GALLERY_GROUP = "Data viz";

const minute = 60;
const end = new Date(2026, 9, 7, 14, 23, 16).getTime() / 1000;
const at = (h: number, m: number, s = 0) => new Date(2026, 9, 7, h, m, s).getTime() / 1000;
const step = 5;
const first = Math.ceil((end - 15 * minute) / step) * step;
const times = Array.from({ length: Math.floor((end - first) / step) + 1 }, (_, index) => first + index * step);
const wave = (t: number, peak: number, period: number, mid: number, amplitude: number) =>
  mid + amplitude * Math.cos((2 * Math.PI * (t - peak)) / period);
const ease = (t: number, from: number, to: number, a: number, b: number) =>
  a + (b - a) * (0.5 - 0.5 * Math.cos((Math.PI * (t - from)) / (to - from)));

function cpu(t: number): number {
  if (t < at(14, 14, 0)) return wave(t, at(14, 10, 10), 7.66 * minute, 0.3, 0.25);
  if (t < at(14, 15, 0)) return ease(t, at(14, 14, 0), at(14, 15, 0), 0.05, 0.15);
  if (t < at(14, 15, 10)) return ease(t, at(14, 15, 0), at(14, 15, 10), 0.15, 0.6);
  if (t < at(14, 16, 15)) return ease(t, at(14, 15, 10), at(14, 16, 15), 0.6, 0.8);
  if (t < at(14, 16, 20)) return 0.44;
  if (t < at(14, 21, 15)) return ease(t, at(14, 16, 20), at(14, 21, 15), 0.44, 0.05);
  return ease(t, at(14, 21, 15), end, 0.05, 0.37);
}

const memory = (t: number) => wave(t, at(14, 8, 50), 10 * minute, 0.452, 0.018);
const diskGap = (t: number) => t > at(14, 11, 45) && t < at(14, 13, 20);

export const CHART_SAMPLE = {
  end,
  clock: () => end,
  durationS: 15 * minute,
  height: 200,
  pointerTime: at(14, 16, 20),
  threshold: { value: 0.85, label: "85% warning" } satisfies ChartThreshold,
  emptyLabel: "Collecting data…",
  nowLabel: "now",
  missingLabel: "—",
  title: "Resource history",
};

const points = (fn: (t: number) => number | null): ChartPoint[] => times.map((t) => [t, fn(t)] as const);

export const CHART_SERIES: ChartSeries[] = [
  { key: "load1", label: "CPU load", color: 0, fill: true, points: points(cpu) },
  { key: "memory", label: "Memory", color: 1, points: points(memory) },
  { key: "disk", label: "Disk", color: 2, points: points((t) => (diskGap(t) ? null : 0.62)) },
  { key: "load5", label: "5m load", color: 0, dash: [6, 5], points: points((t) => wave(t, at(14, 12, 0), 15 * minute, 0.3, 0.1)) },
  { key: "load15", label: "15m load", color: 0, dash: [0.1, 5], points: points(() => 0.28) },
];

export const CHART_LEGEND: LegendItem[] = [
  { key: "load1", label: "CPU load", color: 0, value: "34%", caption: "avg 31% · peak 80%" },
  { key: "memory", label: "Memory", color: 1, value: "46%", caption: "avg 45% · peak 47%" },
  { key: "disk", label: "Disk", color: 2, value: "62%", caption: "avg 62% · peak 62%" },
  { key: "load5", label: "5m load", color: 0, dash: [6, 5], value: null, caption: "No samples in range" },
  { key: "load15", label: "15m load", color: 0, dash: [0.1, 5], value: null, caption: "No samples in range" },
];

export const CHART_DEFAULT_HIDDEN = ["load5", "load15"];
