import { CEILING_STEPS, EPSILON, HEADROOM, TICK_MULTIPLIERS, TIME_STEPS_S } from "./constants";
import type { ChartPoint, XY } from "./types";

export function niceCeiling(peak: number, floor = 1): number {
  if (!Number.isFinite(peak) || peak * HEADROOM <= floor) return floor;
  const target = peak * HEADROOM;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  for (const step of CEILING_STEPS) {
    if (step * magnitude >= target - EPSILON) return Math.max(floor, step * magnitude);
  }
  return Math.max(floor, 10 * magnitude);
}

export function valueTicks(ceiling: number, target = 4): number[] {
  if (ceiling <= 0 || !Number.isFinite(ceiling)) return [0];
  let best: { score: number; step: number } | null = null;
  const exponent = Math.floor(Math.log10(ceiling));
  for (let power = exponent - 2; power <= exponent; power += 1) {
    for (const multiplier of TICK_MULTIPLIERS) {
      const step = multiplier * 10 ** power;
      const count = ceiling / step;
      const rounded = Math.round(count);
      if (Math.abs(count - rounded) > 1e-6 || rounded < 2 || rounded > 6) continue;
      const score = Math.abs(rounded - target);
      if (!best || score < best.score || (score === best.score && step > best.step)) best = { score, step };
    }
  }
  const step = best ? best.step : ceiling;
  const count = Math.round(ceiling / step);
  return Array.from({ length: count + 1 }, (_, index) => Math.round(index * step * 1e10) / 1e10);
}

export function timeStep(spanS: number, maxTicks: number): number {
  for (const step of TIME_STEPS_S) {
    if (spanS / step <= Math.max(1, maxTicks)) return step;
  }
  return TIME_STEPS_S[TIME_STEPS_S.length - 1] ?? 7200;
}

export function localOffsetS(t: number): number {
  return -new Date(t * 1000).getTimezoneOffset() * 60;
}

export function timeTicks(start: number, end: number, maxTicks: number, utcOffsetS?: number): number[] {
  if (end <= start) return [];
  const step = timeStep(end - start, maxTicks);
  const offset = utcOffsetS ?? localOffsetS(start);
  const ticks: number[] = [];
  for (let tick = Math.ceil((start + offset) / step) * step - offset; tick <= end + EPSILON; tick += step) ticks.push(tick);
  return ticks;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function timeLabel(t: number, stepS: number): string {
  const date = new Date(t * 1000);
  const base = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return stepS < 60 ? `${base}:${pad(date.getSeconds())}` : base;
}

export function percentLabel(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function splitSegments(points: readonly ChartPoint[]): XY[][] {
  const segments: XY[][] = [];
  let current: XY[] = [];
  for (const [t, value] of points) {
    if (value === null || !Number.isFinite(value)) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    current.push([t, value]);
  }
  if (current.length) segments.push(current);
  return segments;
}

export function monotoneTangents(points: readonly XY[]): number[] {
  const n = points.length;
  if (n < 2) return new Array<number>(n).fill(0);
  const at = (index: number) => points[index] as XY;
  const dx = Array.from({ length: n - 1 }, (_, i) => at(i + 1)[0] - at(i)[0]);
  const slopes = dx.map((delta, i) => (delta ? (at(i + 1)[1] - at(i)[1]) / delta : 0));
  const slope = (index: number) => slopes[index] ?? 0;
  const tangents = [slope(0), ...Array.from({ length: n - 2 }, (_, i) => (slope(i) + slope(i + 1)) / 2), slope(n - 2)];
  slopes.forEach((s, i) => {
    if (s === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      return;
    }
    let a = (tangents[i] ?? 0) / s;
    let b = (tangents[i + 1] ?? 0) / s;
    if (a < 0) {
      tangents[i] = 0;
      a = 0;
    }
    if (b < 0) {
      tangents[i + 1] = 0;
      b = 0;
    }
    const magnitude = a * a + b * b;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      tangents[i] = scale * a * s;
      tangents[i + 1] = scale * b * s;
    }
  });
  return tangents;
}

export function bezierControls(points: readonly XY[]): [XY, XY, XY][] {
  const tangents = monotoneTangents(points);
  const curves: [XY, XY, XY][] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i] as XY;
    const [x1, y1] = points[i + 1] as XY;
    const third = (x1 - x0) / 3;
    curves.push([
      [x0 + third, y0 + (tangents[i] ?? 0) * third],
      [x1 - third, y1 - (tangents[i + 1] ?? 0) * third],
      [x1, y1],
    ]);
  }
  return curves;
}

export function nearest(times: readonly number[], t: number): number | null {
  if (!times.length) return null;
  let low = 0;
  let high = times.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((times[mid] ?? 0) < t) low = mid + 1;
    else high = mid;
  }
  if (low === 0) return 0;
  if (low >= times.length) return times.length - 1;
  return (times[low] ?? 0) - t < t - (times[low - 1] ?? 0) ? low : low - 1;
}

export function crisp(value: number, scale: number, width = 1): number {
  let device = Math.round(value * scale);
  if (Math.round(width * scale) % 2 === 1) device += 0.5;
  return device / scale;
}

export function easeOut(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return 1 - (1 - p) ** 3;
}

export function wallClockSeconds(): number {
  return Date.now() / 1000;
}

export function formatPercent(value: number): string {
  return percentLabel(value);
}
