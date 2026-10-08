import type { TokenUsage } from "@tesseract/protocol";

export type RangeDays = 7 | 30 | 90;

export type TokenKey = Exclude<keyof TokenUsage, "totalTokens">;

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
};

export type ChartBucket = {
  id: string;
  /** Full label for the readout and the table, e.g. "Sep 24" or "Sep 1 – Sep 7". */
  label: string;
  /** Short label for the x axis. */
  axisLabel: string;
  /** One value per series, in series order. */
  values: number[];
};

export type StackSegment = {
  seriesIndex: number;
  value: number;
  y0: number;
  y1: number;
};

export type DeltaKind = "up" | "down" | "flat" | "new";

export type Delta = {
  kind: DeltaKind;
  /** Relative change, e.g. 0.12 for +12%. Null when the previous period was zero. */
  ratio: number | null;
};

export type BarItem = {
  id: string;
  label: string;
  value: number;
  valueLabel: string;
  detail?: string;
  onPress?: () => void;
};

export type HeatmapGrid = {
  /** Seven rows, Monday first, of 24 hourly counts in local time. */
  cells: number[][];
  max: number;
  total: number;
};

export type HeatCell = {
  weekday: number;
  hour: number;
  count: number;
};
