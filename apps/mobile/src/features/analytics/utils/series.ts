import type { TokenUsage, UsageDay } from "@theone/protocol";

import type { ChartBucket, StackSegment, TokenKey } from "../types";
import { formatDay, formatDayRange } from "./format";

/** Stack order, bottom to top. Also the categorical slot order, so every adjacent pair is a validated one. */
export const TOKEN_KEYS: readonly TokenKey[] = ["inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens"];

export const TOKEN_LABELS: Record<TokenKey, string> = {
  inputTokens: "Input",
  outputTokens: "Output",
  cacheReadTokens: "Cache read",
  cacheWriteTokens: "Cache write",
};

const WEEKLY_THRESHOLD_DAYS = 45;

export function bucketSizeFor(days: number): number {
  return days > WEEKLY_THRESHOLD_DAYS ? 7 : 1;
}

/**
 * Groups consecutive days into buckets of `size`, counted back from the newest day so the latest bucket is always
 * complete; only the oldest bucket can be short.
 */
export function bucketDays(daily: readonly UsageDay[], size: number): UsageDay[][] {
  const groups: UsageDay[][] = [];
  for (let end = daily.length; end > 0; end -= size) {
    groups.unshift(daily.slice(Math.max(0, end - size), end));
  }
  return groups;
}

export function tokenValues(usage: TokenUsage): number[] {
  return TOKEN_KEYS.map((key) => usage[key]);
}

function bucketFrom(days: readonly UsageDay[], values: number[]): ChartBucket {
  const first = days[0].date;
  const last = days[days.length - 1].date;
  return { id: first, label: formatDayRange(first, last), axisLabel: formatDay(first), values };
}

export function tokenBuckets(daily: readonly UsageDay[], size: number): ChartBucket[] {
  return bucketDays(daily, size).map((days) =>
    bucketFrom(
      days,
      TOKEN_KEYS.map((key) => days.reduce((sum, day) => sum + day[key], 0)),
    ),
  );
}

export function sessionBuckets(daily: readonly UsageDay[]): ChartBucket[] {
  return daily.map((day) => bucketFrom([day], [day.sessions]));
}

export function stackValues(values: readonly number[]): StackSegment[] {
  let base = 0;
  return values.map((value, seriesIndex) => {
    const segment = { seriesIndex, value, y0: base, y1: base + value };
    base += value;
    return segment;
  });
}

export function bucketTotal(bucket: ChartBucket): number {
  return bucket.values.reduce((sum, value) => sum + value, 0);
}

export function seriesTotals(buckets: readonly ChartBucket[], seriesCount: number): number[] {
  return Array.from({ length: seriesCount }, (_, index) =>
    buckets.reduce((sum, bucket) => sum + (bucket.values[index] ?? 0), 0),
  );
}

function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
}

/** Clean, evenly spaced ticks from 0 that cover `max`. Integer-only when `integer` is set (counts). */
export function niceTicks(max: number, target = 4, integer = false): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  let step = niceStep(max / target);
  if (integer) step = Math.max(1, Math.ceil(step));
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(Number(value.toPrecision(12)));
  return ticks;
}

/** Evenly spread indexes for axis labels, always including the first and the last. */
export function axisLabelIndexes(count: number, maxLabels = 4): number[] {
  if (count <= 0) return [];
  if (count <= maxLabels) return Array.from({ length: count }, (_, index) => index);
  const step = (count - 1) / (maxLabels - 1);
  return Array.from({ length: maxLabels }, (_, index) => Math.round(index * step));
}

export function indexAtX(x: number, width: number, count: number): number | null {
  if (count <= 0 || width <= 0) return null;
  return Math.min(count - 1, Math.max(0, Math.floor((x / width) * count)));
}
