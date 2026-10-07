export type ChartPoint = readonly [t: number, value: number | null];
export type XY = [number, number];

export interface ChartSeries {
  key: string;
  label: string;
  color: number;
  points: readonly ChartPoint[];
  fill?: boolean;
  dash?: readonly number[];
}

export interface ChartThreshold {
  value: number;
  label: string;
}
