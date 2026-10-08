import type { ClaudeSession } from "@tesseract/protocol";

import { formatRelativeTime } from "@/features/sandbox/utils/format";

import type { HeatCell, HeatmapGrid } from "../types";
import { formatCompact } from "./format";

const HOURS = 24;
const WEEK = 7;

export const TOP_SESSIONS_LIMIT = 10;

const time = (iso: string) => {
  const value = Date.parse(iso);
  return Number.isNaN(value) ? null : value;
};

/** Sessions with any activity since `from` (the start of the selected range). */
export function sessionsActiveSince(sessions: readonly ClaudeSession[], from: string): ClaudeSession[] {
  const start = time(from);
  if (start === null) return [...sessions];
  return sessions.filter((session) => (time(session.lastActiveAt) ?? 0) >= start);
}

export function rankSessionsByTokens(sessions: readonly ClaudeSession[], limit = TOP_SESSIONS_LIMIT): ClaudeSession[] {
  return [...sessions]
    .sort((a, b) => b.usage.totalTokens - a.usage.totalTokens || b.lastActiveAt.localeCompare(a.lastActiveAt))
    .slice(0, limit);
}

/** Monday-first weekday index for a JS `Date#getDay()` value. */
export function mondayFirst(day: number): number {
  return (day + 6) % WEEK;
}

/** Counts session starts since `from` by local weekday and hour. */
export function sessionStartHeatmap(sessions: readonly ClaudeSession[], from: string): HeatmapGrid {
  const cells = Array.from({ length: WEEK }, () => Array<number>(HOURS).fill(0));
  const start = time(from) ?? Number.NEGATIVE_INFINITY;
  let total = 0;
  for (const session of sessions) {
    const started = time(session.startedAt);
    if (started === null || started < start) continue;
    const date = new Date(started);
    cells[mondayFirst(date.getDay())][date.getHours()] += 1;
    total += 1;
  }
  const max = cells.reduce((best, row) => Math.max(best, ...row), 0);
  return { cells, max, total };
}

/** Bucket index into a ramp of `steps` colors: 0 for an empty cell, 1..steps-1 by share of the max. */
export function heatLevel(count: number, max: number, steps: number): number {
  if (count <= 0 || max <= 0 || steps < 2) return 0;
  return Math.min(steps - 1, Math.max(1, Math.ceil((count / max) * (steps - 1))));
}

export function busiestCell(grid: HeatmapGrid): HeatCell | null {
  let best: HeatCell | null = null;
  grid.cells.forEach((row, weekday) =>
    row.forEach((count, hour) => {
      if (count > 0 && (!best || count > best.count)) best = { weekday, hour, count };
    }),
  );
  return best;
}

export type SessionTarget = { kind: "agent"; id: string } | { kind: "terminal"; id: string } | null;

export function sessionTarget(session: ClaudeSession): SessionTarget {
  if (session.agentRunId) return { kind: "agent", id: session.agentRunId };
  if (session.terminalId) return { kind: "terminal", id: session.terminalId };
  return null;
}

export const SESSION_SOURCE_LABELS: Record<ClaudeSession["source"], string> = {
  "agent-run": "Agent run",
  terminal: "Terminal",
  cli: "CLI",
};

export type SessionSummary = {
  title: string;
  meta: string;
  tokens: string;
  active: boolean;
};

export function summarizeSession(session: ClaudeSession, now: number = Date.now()): SessionSummary {
  const parts = [SESSION_SOURCE_LABELS[session.source]];
  if (session.model) parts.push(session.model);
  const seen = formatRelativeTime(session.lastActiveAt, now);
  if (seen) parts.push(seen);
  return {
    title: session.title ?? "Untitled session",
    meta: parts.join(", "),
    tokens: formatCompact(session.usage.totalTokens),
    active: session.active,
  };
}
