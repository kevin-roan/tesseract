import { sampleAgentRun, sampleProcess, sampleTerminal, sampleUsageReport } from "@theone/protocol/fixtures";

import { homeStats } from "@/features/home/utils/stats";
import { cachedPercent, formatCount, formatTokens, splitCells, tokenSplit } from "@/features/home/utils/tokens";
import {
  activeProjectIds,
  barHeight,
  busiestDay,
  dailyReadout,
  dailyTotals,
  hasUsage,
  latestDay,
  runningAgentCount,
  usageRangeOptions,
} from "@/features/home/utils/usage";

describe("formatTokens", () => {
  it.each([
    [0, "0"],
    [-5, "0"],
    [Number.NaN, "0"],
    [999, "999"],
    [1000, "1k"],
    [1234, "1.2k"],
    [34_000, "34k"],
    [340_500, "341k"],
    [999_960, "1M"],
    [1_200_000, "1.2M"],
    [3_400_000_000, "3.4B"],
  ])("formats %d as %s", (count, text) => {
    expect(formatTokens(count)).toBe(text);
  });

  it("groups whole counts with separators", () => {
    expect(formatCount(24891)).toBe("24,891");
  });
});

describe("tokenSplit", () => {
  it("splits totals into input, output and cache parts that sum to one", () => {
    const parts = tokenSplit(sampleUsageReport.totals);
    expect(parts.map((part) => part.id)).toEqual(["input", "output", "cacheRead", "cacheWrite"]);
    expect(parts[2].value).toBe(56000);
    expect(parts.reduce((sum, part) => sum + part.fraction, 0)).toBeCloseTo(1);
  });

  it("gives zero fractions when nothing was used", () => {
    const parts = tokenSplit({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0 });
    expect(parts.every((part) => part.fraction === 0)).toBe(true);
  });
});

describe("usage helpers", () => {
  it("reads today from the last daily entry", () => {
    expect(latestDay(sampleUsageReport)).toEqual({ tokens: 68400, sessions: 2, messages: 12 });
    expect(latestDay(undefined)).toEqual({ tokens: 0, sessions: 0, messages: 0 });
  });

  it("lists daily totals oldest first", () => {
    expect(dailyTotals(sampleUsageReport)).toEqual([
      { date: "2026-09-22", tokens: 0 },
      { date: "2026-09-23", tokens: 68400 },
    ]);
    expect(dailyTotals(undefined)).toEqual([]);
  });

  it("knows when there is no usage", () => {
    expect(hasUsage(sampleUsageReport)).toBe(true);
    expect(hasUsage({ ...sampleUsageReport, totals: { ...sampleUsageReport.totals, totalTokens: 0, messages: 0 } })).toBe(false);
  });

  it("collects projects with live processes, runs or terminals", () => {
    const ids = activeProjectIds(
      [sampleProcess, { ...sampleProcess, projectId: "stopped", state: "stopped" }],
      [{ ...sampleAgentRun, projectId: "agent-project" }, { ...sampleAgentRun, projectId: "done", state: "succeeded" }],
      [{ ...sampleTerminal, projectId: "shell-project", state: "running" }, { ...sampleTerminal, projectId: "gone", state: "exited" }],
    );
    expect([...ids].sort()).toEqual(["agent-project", sampleProcess.projectId, "shell-project"].sort());
  });

  it("counts running agents", () => {
    expect(runningAgentCount([sampleAgentRun, { ...sampleAgentRun, id: "run_2", state: "failed" }])).toBe(1);
  });
});

describe("busiestDay", () => {
  const day = (tokens: number, date = "2026-09-22") => ({ date, tokens });

  it("picks the largest day and prefers the most recent on ties", () => {
    expect(busiestDay([day(5), day(20), day(20), day(1)])).toBe(2);
  });

  it("returns -1 when nothing happened", () => {
    expect(busiestDay([day(0), day(0)])).toBe(-1);
    expect(busiestDay([])).toBe(-1);
  });
});

describe("barHeight", () => {
  it("scales against the max and keeps a visible floor for quiet days", () => {
    expect(barHeight(50, 100, 72)).toBe(36);
    expect(barHeight(100, 100, 72)).toBe(72);
    expect(barHeight(1, 100_000, 72)).toBe(3);
  });

  it("draws nothing for empty days or an empty scale", () => {
    expect(barHeight(0, 100, 72)).toBe(0);
    expect(barHeight(5, 0, 72)).toBe(0);
  });
});

describe("homeStats", () => {
  it("gives each card its pastel tone and a spaced denominator", () => {
    const stats = homeStats({ activeProjects: 3, totalProjects: 4, runningAgents: 1, sessionsToday: 2, tokensToday: 1200, messagesToday: 1 });

    expect(stats.map((stat) => stat.tone)).toEqual(["lavender", "mint", "sky", "rose"]);
    expect(stats[0]).toMatchObject({ value: "3", unit: "/ 4", progress: 0.75 });
    expect(stats[3]).toMatchObject({ value: "1.2k", unit: "1 msg" });
    expect(homeStats({ activeProjects: 0, totalProjects: 0, runningAgents: 0, sessionsToday: 0, tokensToday: 0, messagesToday: 0 })[0].progress).toBe(0);
  });
});

describe("dailyReadout", () => {
  const days = [
    { date: "2026-09-28", tokens: 5000 },
    { date: "2026-09-29", tokens: 0 },
    { date: "2026-09-30", tokens: 1200 },
  ];

  it("reads the busiest day until a day is picked", () => {
    expect(dailyReadout(days, null)).toEqual({ title: "Busiest · Sep 28", value: "5k tokens" });
    expect(dailyReadout(days, 2)).toEqual({ title: "Today", value: "1.2k tokens" });
    expect(dailyReadout([{ date: "2026-09-30", tokens: 0 }], null)).toEqual({ title: "No activity", value: "0 tokens" });
  });
});

describe("usageRangeOptions", () => {
  it("labels ranges short with a spoken label", () => {
    expect(usageRangeOptions([7, 30])).toEqual([
      { value: 7, label: "7d", accessibilityLabel: "7 days" },
      { value: 30, label: "30d", accessibilityLabel: "30 days" },
    ]);
  });
});

describe("cachedPercent", () => {
  it("shares prompt tokens served from the cache", () => {
    expect(cachedPercent({ inputTokens: 10, cacheReadTokens: 80, cacheWriteTokens: 10 })).toBe(80);
    expect(cachedPercent({ inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeNull();
  });
});

describe("splitCells", () => {
  it("hands out every cell by share, largest remainder first", () => {
    const cells = splitCells([{ fraction: 0.5 }, { fraction: 0.3 }, { fraction: 0.2 }, { fraction: 0 }], 10);
    expect(cells).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 2, 2]);
    expect(splitCells([{ fraction: 1 / 3 }, { fraction: 2 / 3 }], 4)).toEqual([0, 1, 1, 1]);
  });

  it("keeps at least one cell for every used part, however small", () => {
    const cells = splitCells([{ fraction: 0.005 }, { fraction: 0.9 }, { fraction: 0.095 }, { fraction: 0 }], 32);
    expect(cells).toHaveLength(32);
    expect(cells.filter((cell) => cell === 0)).toHaveLength(1);
    expect(cells.filter((cell) => cell === 2)).toHaveLength(3);
    expect(cells).not.toContain(3);
  });

  it("leaves every cell empty when nothing was used", () => {
    expect(splitCells([{ fraction: 0 }, { fraction: 0 }], 3)).toEqual([-1, -1, -1]);
  });
});
