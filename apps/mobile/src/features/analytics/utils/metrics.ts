import type { TokenUsage, UsageDay, UsageReport } from "@tesseract/protocol";

import type { Delta } from "../types";

export const MAX_RANGE_DAYS = 90;
const FLAT_THRESHOLD = 0.005;

/** Share of prompt tokens served from the cache: cacheRead / (input + cacheRead + cacheWrite). */
export function cacheHitRate(usage: Pick<TokenUsage, "inputTokens" | "cacheReadTokens" | "cacheWriteTokens">): number | null {
  const prompt = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  return prompt > 0 ? usage.cacheReadTokens / prompt : null;
}

export type PeriodSums = {
  totalTokens: number;
  messages: number;
};

export function sumDays(days: readonly UsageDay[]): PeriodSums {
  return days.reduce<PeriodSums>(
    (sum, day) => ({ totalTokens: sum.totalTokens + day.totalTokens, messages: sum.messages + day.messages }),
    { totalTokens: 0, messages: 0 },
  );
}

/** A comparison is only possible when twice the range still fits in the history the controller keeps. */
export function comparisonDays(days: number): number | null {
  const doubled = days * 2;
  return doubled <= MAX_RANGE_DAYS ? doubled : null;
}

/**
 * The period right before the current one, taken from a report that covers twice the range: every day except the
 * newest `days` of it. Null when the report is missing or too short to hold a full previous period.
 */
export function previousPeriod(comparison: UsageReport | undefined, days: number): PeriodSums | null {
  if (!comparison || comparison.daily.length < days * 2) return null;
  return sumDays(comparison.daily.slice(0, comparison.daily.length - days));
}

export function computeDelta(current: number, previous: number | null): Delta | null {
  if (previous === null) return null;
  if (previous === 0) return current === 0 ? { kind: "flat", ratio: 0 } : { kind: "new", ratio: null };
  const ratio = (current - previous) / previous;
  if (Math.abs(ratio) < FLAT_THRESHOLD) return { kind: "flat", ratio: 0 };
  return { kind: ratio > 0 ? "up" : "down", ratio };
}

export function hasUsage(report: UsageReport | undefined): boolean {
  return !!report && (report.totals.totalTokens > 0 || report.totals.messages > 0 || report.totals.sessions > 0);
}
