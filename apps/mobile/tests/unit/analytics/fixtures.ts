import type { ClaudeSession, UsageDay, UsageReport } from "@tesseract/protocol";
import { sampleClaudeSession } from "@tesseract/protocol/fixtures";

const ZERO = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, messages: 0, sessions: 0 };

export function day(date: string, input = 0, output = 0, cacheRead = 0, cacheWrite = 0, messages = 0, sessions = 0): UsageDay {
  return {
    date,
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    totalTokens: input + output + cacheRead + cacheWrite,
    messages,
    sessions,
  };
}

export function datesEnding(end: string, count: number): string[] {
  const last = Date.parse(`${end}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(last - (count - 1 - index) * 86_400_000).toISOString().slice(0, 10),
  );
}

export function report(daily: UsageDay[], overrides: Partial<UsageReport> = {}): UsageReport {
  const totals = daily.reduce(
    (sum, entry) => ({
      inputTokens: sum.inputTokens + entry.inputTokens,
      outputTokens: sum.outputTokens + entry.outputTokens,
      cacheReadTokens: sum.cacheReadTokens + entry.cacheReadTokens,
      cacheWriteTokens: sum.cacheWriteTokens + entry.cacheWriteTokens,
      totalTokens: sum.totalTokens + entry.totalTokens,
      messages: sum.messages + entry.messages,
      sessions: sum.sessions + entry.sessions,
    }),
    { ...ZERO },
  );
  return {
    generatedAt: `${daily[daily.length - 1]?.date ?? "2026-09-24"}T12:00:00.000Z`,
    from: `${daily[0]?.date ?? "2026-09-24"}T00:00:00.000Z`,
    to: `${daily[daily.length - 1]?.date ?? "2026-09-24"}T12:00:00.000Z`,
    days: daily.length,
    totals,
    daily,
    models: [],
    projects: [],
    ...overrides,
  };
}

export const WEEK_DATES = datesEnding("2026-09-24", 7);

export const weekReport = report(
  WEEK_DATES.map((date, index) => day(date, 100 * (index + 1), 50, 1000, 200, index + 1, index % 3)),
  {
    models: [
      { model: "claude-opus-4-5", inputTokens: 2000, outputTokens: 300, cacheReadTokens: 6000, cacheWriteTokens: 1200, totalTokens: 9500, messages: 20 },
      { model: "claude-haiku-4-5", inputTokens: 800, outputTokens: 50, cacheReadTokens: 1000, cacheWriteTokens: 200, totalTokens: 2050, messages: 8 },
    ],
    projects: [
      { projectId: "electron-hello", inputTokens: 2000, outputTokens: 300, cacheReadTokens: 6000, cacheWriteTokens: 1200, totalTokens: 9500, messages: 20, sessions: 3 },
      { projectId: null, inputTokens: 800, outputTokens: 50, cacheReadTokens: 1000, cacheWriteTokens: 200, totalTokens: 2050, messages: 8, sessions: 1 },
    ],
  },
);

export const emptyWeekReport = report(WEEK_DATES.map((date) => day(date)));

export function session(overrides: Partial<ClaudeSession> = {}): ClaudeSession {
  return { ...sampleClaudeSession, ...overrides };
}

export const weekSessions: ClaudeSession[] = [
  session({
    sessionId: "s-big",
    startedAt: "2026-09-23T09:00:00.000Z",
    lastActiveAt: "2026-09-23T10:00:00.000Z",
    usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 1, cacheWriteTokens: 1, totalTokens: 90_000 },
  }),
  session({
    sessionId: "s-terminal",
    title: null,
    source: "terminal",
    agentRunId: null,
    terminalId: "trm_1",
    projectId: null,
    active: true,
    startedAt: "2026-09-22T09:00:00.000Z",
    lastActiveAt: "2026-09-24T11:00:00.000Z",
    usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 1, cacheWriteTokens: 1, totalTokens: 4_000 },
  }),
  session({
    sessionId: "s-cli",
    source: "cli",
    agentRunId: null,
    terminalId: null,
    startedAt: "2026-09-19T09:00:00.000Z",
    lastActiveAt: "2026-09-20T09:00:00.000Z",
    usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 1, cacheWriteTokens: 1, totalTokens: 12_000 },
  }),
  session({
    sessionId: "s-old",
    startedAt: "2026-08-01T09:00:00.000Z",
    lastActiveAt: "2026-08-02T09:00:00.000Z",
    usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 1, cacheWriteTokens: 1, totalTokens: 500_000 },
  }),
];
