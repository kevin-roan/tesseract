export type ChartPoint = { t: number; value: number | null };

export type ChartDash = "solid" | "dash" | "dot";

export type ChartFrame = { left: number; top: number; width: number; height: number };

export type ChartScale = { start: number; end: number; max: number; frame: ChartFrame };

export const DashArrays: Record<ChartDash, string | undefined> = {
  solid: undefined,
  dash: "6 5",
  dot: "1 4",
};

const MINUTE = 60_000;
const TIME_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 240].map((minutes) => minutes * MINUTE);
const Y_DIVISIONS = 4;

/** Upper bound of the value axis: 100% unless a series overshoots, then the next quarter step above it. */
export function valueMax(series: readonly (readonly ChartPoint[])[]): number {
  let peak = 0;
  for (const points of series) {
    for (const point of points) if (point.value !== null && point.value > peak) peak = point.value;
  }
  return peak <= 1 ? 1 : Math.ceil(peak * Y_DIVISIONS) / Y_DIVISIONS;
}

export function valueTicks(max: number): number[] {
  return Array.from({ length: Y_DIVISIONS + 1 }, (_, index) => (max * (Y_DIVISIONS - index)) / Y_DIVISIONS);
}

/** Round clock times inside the range, leaving room at the right edge for the "now" label. */
export function timeTicks(start: number, end: number, target = 3): number[] {
  const span = end - start;
  if (span <= 0) return [];
  const step = TIME_STEPS.find((candidate) => span / candidate <= target + 1) ?? TIME_STEPS[TIME_STEPS.length - 1];
  const ticks: number[] = [];
  for (let t = Math.ceil(start / step) * step; t < end - span * 0.12; t += step) {
    if (t > start + span * 0.04) ticks.push(t);
  }
  return ticks;
}

export const xOf = (scale: ChartScale, t: number) =>
  scale.frame.left + ((t - scale.start) / Math.max(1, scale.end - scale.start)) * scale.frame.width;

export const yOf = (scale: ChartScale, value: number) =>
  scale.frame.top + (1 - Math.min(scale.max, Math.max(0, value)) / scale.max) * scale.frame.height;

export function segments(points: readonly ChartPoint[]): { t: number; value: number }[][] {
  const runs: { t: number; value: number }[][] = [];
  let current: { t: number; value: number }[] = [];
  for (const point of points) {
    if (point.value === null) {
      if (current.length) runs.push(current);
      current = [];
    } else {
      current.push({ t: point.t, value: point.value });
    }
  }
  if (current.length) runs.push(current);
  return runs;
}

export function linePath(scale: ChartScale, points: readonly ChartPoint[]): string {
  return segments(points)
    .map((run) => {
      const coords = run.map((point) => `${xOf(scale, point.t).toFixed(1)},${yOf(scale, point.value).toFixed(1)}`);
      // A lone sample still deserves a visible mark.
      if (coords.length === 1) coords.push(`${(xOf(scale, run[0].t) + 1).toFixed(1)},${yOf(scale, run[0].value).toFixed(1)}`);
      return `M${coords.join("L")}`;
    })
    .join("");
}

export function areaPath(scale: ChartScale, points: readonly ChartPoint[]): string {
  const bottom = (scale.frame.top + scale.frame.height).toFixed(1);
  return segments(points)
    .filter((run) => run.length > 1)
    .map((run) => {
      const coords = run.map((point) => `${xOf(scale, point.t).toFixed(1)},${yOf(scale, point.value).toFixed(1)}`);
      const first = xOf(scale, run[0].t).toFixed(1);
      const last = xOf(scale, run[run.length - 1].t).toFixed(1);
      return `M${first},${bottom}L${coords.join("L")}L${last},${bottom}Z`;
    })
    .join("");
}

export function lastPoint(points: readonly ChartPoint[]): { t: number; value: number } | null {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const { t, value } = points[index];
    if (value !== null) return { t, value };
  }
  return null;
}

export function clockLabel(t: number): string {
  const date = new Date(t);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
