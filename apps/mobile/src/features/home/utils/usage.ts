import { isFinalAgentRunState, type AgentRun, type ProcessInfo, type TerminalInfo, type UsageReport } from "@tesseract/protocol";

import { formatDay } from "@/features/analytics/utils/format";
import { isActiveProcess } from "@/features/sandbox/utils/projects";

import { formatTokens } from "./tokens";

export type UsageRange = 7 | 30;

export const USAGE_RANGES: readonly UsageRange[] = [7, 30];

export type DaySummary = { tokens: number; sessions: number; messages: number };

const EMPTY_DAY: DaySummary = { tokens: 0, sessions: 0, messages: 0 };

export function latestDay(report: UsageReport | undefined): DaySummary {
  const day = report?.daily[report.daily.length - 1];
  return day ? { tokens: day.totalTokens, sessions: day.sessions, messages: day.messages } : EMPTY_DAY;
}

export type DailyTokens = { date: string; tokens: number };

export function dailyTotals(report: UsageReport | undefined): DailyTokens[] {
  return report ? report.daily.map((day) => ({ date: day.date, tokens: day.totalTokens })) : [];
}

export function hasUsage(report: UsageReport | undefined): boolean {
  return Boolean(report && (report.totals.totalTokens > 0 || report.totals.messages > 0));
}

export function activeProjectIds(
  processes: readonly ProcessInfo[],
  runs: readonly AgentRun[],
  terminals: readonly TerminalInfo[],
): Set<string> {
  const ids = new Set<string>();
  for (const process of processes) if (process.projectId && isActiveProcess(process)) ids.add(process.projectId);
  for (const run of runs) if (run.projectId && !isFinalAgentRunState(run.state)) ids.add(run.projectId);
  for (const terminal of terminals) if (terminal.projectId && terminal.state === "running") ids.add(terminal.projectId);
  return ids;
}

export function runningAgentCount(runs: readonly AgentRun[]): number {
  return runs.filter((run) => !isFinalAgentRunState(run.state)).length;
}

/** Index of the day with the most tokens, or -1 when every day is empty. Ties go to the most recent day. */
export function busiestDay(days: readonly DailyTokens[]): number {
  let index = -1;
  days.forEach((day, i) => {
    if (day.tokens > 0 && (index < 0 || day.tokens >= days[index].tokens)) index = i;
  });
  return index;
}

/** Bar height for `value` on a 0..max scale. Non-zero days keep a `floor` so a quiet day never reads as empty. */
export function barHeight(value: number, max: number, height: number, floor = 3): number {
  if (value <= 0 || max <= 0 || height <= 0) return 0;
  return Math.min(height, Math.max(floor, (value / max) * height));
}

export const rangeShortLabel = (range: UsageRange) => `${range}d`;

export const rangeLabel = (range: UsageRange) => `${range} days`;

export type DailyReadout = { title: string; value: string };

/** Heading above the bars: the day being touched, else the busiest day of the range. */
export function dailyReadout(days: readonly DailyTokens[], selected: number | null): DailyReadout {
  if (selected !== null && days[selected]) {
    const title = selected === days.length - 1 ? "Today" : formatDay(days[selected].date);
    return { title, value: `${formatTokens(days[selected].tokens)} tokens` };
  }
  const busiest = busiestDay(days);
  if (busiest < 0) return { title: "No activity", value: "0 tokens" };
  return { title: `Busiest · ${formatDay(days[busiest].date)}`, value: `${formatTokens(days[busiest].tokens)} tokens` };
}

export type UsageRangeOption = { value: UsageRange; label: string; accessibilityLabel: string };

export function usageRangeOptions(ranges: readonly UsageRange[]): UsageRangeOption[] {
  return ranges.map((value) => ({ value, label: rangeShortLabel(value), accessibilityLabel: rangeLabel(value) }));
}
