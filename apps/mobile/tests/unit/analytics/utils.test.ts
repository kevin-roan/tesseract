import { sampleUsageReport } from "@theone/protocol/fixtures";

import {
  busiestCell,
  heatLevel,
  mondayFirst,
  rankSessionsByTokens,
  sessionStartHeatmap,
  sessionTarget,
  sessionsActiveSince,
  summarizeSession,
} from "@/features/analytics/utils/activity";
import {
  formatCompact,
  formatCount,
  formatDay,
  formatDayRange,
  formatDelta,
  formatPercent,
  plural,
  rangeLabel,
} from "@/features/analytics/utils/format";
import { MARK, layoutStackedBars, roundedTopRect } from "@/features/analytics/utils/geometry";
import { cacheHitRate, comparisonDays, computeDelta, hasUsage, previousPeriod, sumDays } from "@/features/analytics/utils/metrics";
import { projectItems } from "@/features/analytics/utils/view-model";
import { buildProjectView } from "@/features/analytics/utils/project-view";
import { DEFAULT_RANGE, parseRange } from "@/features/analytics/utils/range";
import { usageHeroData } from "@/features/analytics/utils/overview";
import {
  axisLabelIndexes,
  bucketDays,
  bucketSizeFor,
  bucketTotal,
  indexAtX,
  niceTicks,
  seriesTotals,
  sessionBuckets,
  stackValues,
  tokenBuckets,
} from "@/features/analytics/utils/series";
import { bucketTableColumns, bucketTableRows, heatmapTableRows } from "@/features/analytics/utils/tables";

import { datesEnding, day, emptyWeekReport, report, session, weekReport, weekSessions } from "./fixtures";

describe("number formatting", () => {
  it("compacts large numbers without rounding up into the wrong unit", () => {
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(999)).toBe("999");
    expect(formatCompact(1284)).toBe("1.3K");
    expect(formatCompact(12_900)).toBe("12.9K");
    expect(formatCompact(150_000)).toBe("150K");
    expect(formatCompact(999_950)).toBe("1M");
    expect(formatCompact(4_200_000)).toBe("4.2M");
    expect(formatCompact(2_000_000_000)).toBe("2B");
    expect(formatCompact(Number.NaN)).toBe("0");
  });

  it("groups thousands", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(68400)).toBe("68,400");
    expect(formatCount(1_234_567.4)).toBe("1,234,567");
  });

  it("formats percentages and deltas", () => {
    expect(formatPercent(null)).toBe("–");
    expect(formatPercent(0.004)).toBe("<1%");
    expect(formatPercent(0.8187)).toBe("82%");
    expect(formatDelta({ kind: "up", ratio: 0.123 })).toBe("+12%");
    expect(formatDelta({ kind: "down", ratio: -0.084 })).toBe("−8.4%");
    expect(formatDelta({ kind: "flat", ratio: 0 })).toBe("No change");
    expect(formatDelta({ kind: "new", ratio: null })).toBe("New");
  });

  it("formats UTC days without shifting them", () => {
    expect(formatDay("2026-09-01")).toBe("Sep 1");
    expect(formatDayRange("2026-09-01", "2026-09-07")).toBe("Sep 1 – 7");
    expect(formatDayRange("2026-08-29", "2026-09-04")).toBe("Aug 29 – Sep 4");
    expect(formatDayRange("2026-09-04", "2026-09-04")).toBe("Sep 4");
    expect(rangeLabel(30)).toBe("Last 30 days");
    expect(plural(1, "session")).toBe("1 session");
    expect(plural(1200, "session")).toBe("1,200 sessions");
  });
});

describe("metrics", () => {
  it("computes the cache hit rate over prompt tokens only", () => {
    expect(cacheHitRate(sampleUsageReport.totals)).toBeCloseTo(56000 / (1200 + 56000 + 7800));
    expect(cacheHitRate({ inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeNull();
  });

  it("splits a doubled report into the previous period", () => {
    const dates = datesEnding("2026-09-24", 14);
    const doubled = report(dates.map((date, index) => day(date, index < 7 ? 10 : 30, 0, 0, 0, index < 7 ? 1 : 2)));
    expect(previousPeriod(doubled, 7)).toEqual({ totalTokens: 70, messages: 7 });
    expect(previousPeriod(doubled, 30)).toBeNull();
    expect(previousPeriod(undefined, 7)).toBeNull();
    expect(sumDays(doubled.daily.slice(7))).toEqual({ totalTokens: 210, messages: 14 });
  });

  it("only compares when twice the range fits in the history", () => {
    expect(comparisonDays(7)).toBe(14);
    expect(comparisonDays(30)).toBe(60);
    expect(comparisonDays(90)).toBeNull();
  });

  it("classifies deltas, including a zero baseline", () => {
    expect(computeDelta(120, 100)).toEqual({ kind: "up", ratio: 0.2 });
    expect(computeDelta(50, 100)).toEqual({ kind: "down", ratio: -0.5 });
    expect(computeDelta(1000, 1001)).toEqual({ kind: "flat", ratio: 0 });
    expect(computeDelta(10, 0)).toEqual({ kind: "new", ratio: null });
    expect(computeDelta(0, 0)).toEqual({ kind: "flat", ratio: 0 });
    expect(computeDelta(10, null)).toBeNull();
  });

  it("detects an empty report", () => {
    expect(hasUsage(emptyWeekReport)).toBe(false);
    expect(hasUsage(weekReport)).toBe(true);
    expect(hasUsage(undefined)).toBe(false);
  });
});

describe("series and bucketing", () => {
  it("buckets daily for short ranges and weekly for 90 days", () => {
    expect(bucketSizeFor(7)).toBe(1);
    expect(bucketSizeFor(30)).toBe(1);
    expect(bucketSizeFor(90)).toBe(7);
  });

  it("groups from the newest day so only the oldest bucket is short", () => {
    const daily = datesEnding("2026-09-24", 10).map((date) => day(date, 1));
    const groups = bucketDays(daily, 7);
    expect(groups.map((group) => group.length)).toEqual([3, 7]);
    expect(groups[1][6].date).toBe("2026-09-24");
    const buckets = tokenBuckets(daily, 7);
    expect(buckets[1]).toMatchObject({ id: "2026-09-18", label: "Sep 18 – 24", axisLabel: "Sep 18", values: [7, 0, 0, 0] });
  });

  it("keeps the token series in stack order", () => {
    const [first] = tokenBuckets([day("2026-09-24", 1, 2, 3, 4)], 1);
    expect(first.values).toEqual([1, 2, 3, 4]);
    expect(bucketTotal(first)).toBe(10);
    expect(stackValues(first.values)).toEqual([
      { seriesIndex: 0, value: 1, y0: 0, y1: 1 },
      { seriesIndex: 1, value: 2, y0: 1, y1: 3 },
      { seriesIndex: 2, value: 3, y0: 3, y1: 6 },
      { seriesIndex: 3, value: 4, y0: 6, y1: 10 },
    ]);
    expect(seriesTotals(tokenBuckets(weekReport.daily, 1), 4)).toEqual([
      weekReport.totals.inputTokens,
      weekReport.totals.outputTokens,
      weekReport.totals.cacheReadTokens,
      weekReport.totals.cacheWriteTokens,
    ]);
    expect(sessionBuckets(weekReport.daily).map((bucket) => bucket.values[0])).toEqual([0, 1, 2, 0, 1, 2, 0]);
  });

  it("picks clean ticks, including for all-zero data", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(9500, 3)).toEqual([0, 5000, 10000]);
    expect(niceTicks(2, 3, true)).toEqual([0, 1, 2]);
    expect(niceTicks(0.5, 3, true)).toEqual([0, 1]);
    expect(niceTicks(68400, 4)).toEqual([0, 20000, 40000, 60000, 80000]);
  });

  it("spreads axis labels and maps touches to columns", () => {
    expect(axisLabelIndexes(3)).toEqual([0, 1, 2]);
    expect(axisLabelIndexes(30)).toEqual([0, 10, 19, 29]);
    expect(axisLabelIndexes(0)).toEqual([]);
    expect(indexAtX(0, 300, 30)).toBe(0);
    expect(indexAtX(299, 300, 30)).toBe(29);
    expect(indexAtX(500, 300, 30)).toBe(29);
    expect(indexAtX(-4, 300, 30)).toBe(0);
    expect(indexAtX(10, 0, 30)).toBeNull();
  });
});

describe("bar geometry", () => {
  it("caps bar width, separates segments by the gap and rounds only the top", () => {
    const buckets = tokenBuckets([day("2026-09-24", 10, 10, 0, 20)], 1);
    const layout = layoutStackedBars(buckets, [0, 20, 40], 100, 100);
    const [bar] = layout.bars;
    expect(bar.width).toBe(MARK.maxBarWidth);
    expect(bar.x).toBe((100 - MARK.maxBarWidth) / 2);
    expect(bar.segments.map((segment) => segment.seriesIndex)).toEqual([0, 1, 3]);
    expect(bar.segments[0]).toEqual({ seriesIndex: 0, y: 75, height: 25, rounded: false });
    expect(bar.segments[1]).toEqual({ seriesIndex: 1, y: 50, height: 25 - MARK.gap, rounded: false });
    expect(bar.segments[2].rounded).toBe(true);
    expect(layout.ticks).toEqual([
      { value: 0, y: 100 },
      { value: 20, y: 50 },
      { value: 40, y: 0 },
    ]);
  });

  it("leaves a narrow band with a surface gap and draws nothing for empty days", () => {
    const buckets = tokenBuckets(emptyWeekReport.daily, 1);
    const layout = layoutStackedBars(buckets, [0, 1], 70, 100);
    expect(layout.bars[0].width).toBe(10 - MARK.gap);
    expect(layout.bars.every((bar) => bar.segments.length === 0)).toBe(true);
  });

  it("draws a rounded-top path that never exceeds the bar", () => {
    expect(roundedTopRect(0, 0, 10, 20, 4)).toBe("M0,20 L0,4 Q0,0 4,0 L6,0 Q10,0 10,4 L10,20 Z");
    expect(roundedTopRect(0, 0, 4, 1, 4)).toContain("L0,1");
  });
});

describe("sessions and activity", () => {
  it("keeps sessions active in the range and ranks them by tokens", () => {
    const active = sessionsActiveSince(weekSessions, weekReport.from);
    expect(active.map((entry) => entry.sessionId)).toEqual(["s-big", "s-terminal", "s-cli"]);
    expect(rankSessionsByTokens(active).map((entry) => entry.sessionId)).toEqual(["s-big", "s-cli", "s-terminal"]);
    expect(rankSessionsByTokens(active, 1)).toHaveLength(1);
  });

  it("buckets session starts by local weekday and hour", () => {
    const local = new Date(2026, 8, 23, 14, 30);
    const grid = sessionStartHeatmap(
      [session({ startedAt: local.toISOString() }), session({ startedAt: local.toISOString() })],
      "2026-09-01T00:00:00.000Z",
    );
    expect(grid.total).toBe(2);
    expect(grid.max).toBe(2);
    expect(grid.cells[mondayFirst(local.getDay())][14]).toBe(2);
    expect(busiestCell(grid)).toEqual({ weekday: mondayFirst(local.getDay()), hour: 14, count: 2 });
    expect(sessionStartHeatmap(weekSessions, weekReport.from).total).toBe(3);
    expect(busiestCell(sessionStartHeatmap([], weekReport.from))).toBeNull();
  });

  it("maps counts onto the ramp with zero kept apart", () => {
    expect(mondayFirst(0)).toBe(6);
    expect(mondayFirst(1)).toBe(0);
    expect(heatLevel(0, 10, 6)).toBe(0);
    expect(heatLevel(1, 10, 6)).toBe(1);
    expect(heatLevel(10, 10, 6)).toBe(5);
    expect(heatLevel(3, 0, 6)).toBe(0);
  });

  it("links sessions to their run or terminal", () => {
    expect(sessionTarget(weekSessions[0])).toEqual({ kind: "agent", id: "run_q1w2e3r4t5" });
    expect(sessionTarget(weekSessions[1])).toEqual({ kind: "terminal", id: "trm_1" });
    expect(sessionTarget(weekSessions[2])).toBeNull();
  });

  it("summarizes a session for its row", () => {
    const now = Date.parse("2026-09-24T12:00:00.000Z");
    expect(summarizeSession(weekSessions[1], now)).toEqual({
      title: "Untitled session",
      meta: "Terminal, claude-opus-4-5, 1h ago",
      tokens: "4K",
      active: true,
    });
  });
});

describe("tables and view models", () => {
  it("builds table rows newest first", () => {
    const buckets = tokenBuckets([day("2026-09-23", 1, 2, 3, 4), day("2026-09-24", 1000, 0, 0, 0)], 1);
    const series = [
      { key: "a", label: "Input", color: "#000" },
      { key: "b", label: "Output", color: "#000" },
    ];
    expect(bucketTableColumns("Day", series)).toEqual(["Day", "Input", "Output", "Total"]);
    expect(bucketTableColumns("Day", [series[0]])).toEqual(["Day", "Input"]);
    expect(bucketTableRows(buckets, 4)[0].cells).toEqual(["Sep 24", "1,000", "0", "0", "0", "1,000"]);
    expect(bucketTableRows(sessionBuckets(weekReport.daily), 1)[0].cells).toEqual(["Sep 24", "0"]);
    const grid = sessionStartHeatmap(weekSessions, weekReport.from);
    expect(heatmapTableRows(grid)).toHaveLength(3);
  });

  it("names projects and keeps the outside-projects row", () => {
    const items = projectItems(weekReport, new Map([["electron-hello", "Electron Hello"]]));
    expect(items.map((item) => item.label)).toEqual(["Electron Hello", "Outside projects"]);
    expect(items[0]).toMatchObject({ projectId: "electron-hello", valueLabel: "9.5K", detail: "20 messages, 3 sessions" });
    expect(items[1].projectId).toBeNull();
  });

  it("builds a project drill-down, including one with no usage", () => {
    const view = buildProjectView("electron-hello", weekReport, weekSessions);
    expect(view.hasUsage).toBe(true);
    expect(view.tokenMix).toEqual([2000, 300, 6000, 1200]);
    expect(view.sessions.map((entry) => entry.sessionId)).toEqual(["s-big", "s-cli"]);
    expect(view.kpis.find((kpi) => kpi.id === "cache")?.value).toBe("65%");

    const none = buildProjectView("missing", weekReport, []);
    expect(none.hasUsage).toBe(false);
    expect(none.kpis.map((kpi) => kpi.value)).toEqual(["0", "0", "0", "–"]);
    expect(none.heatmap.total).toBe(0);
  });

  it("parses the range parameter", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange(["90"])).toBe(90);
    expect(parseRange("12")).toBe(DEFAULT_RANGE);
    expect(parseRange(undefined)).toBe(DEFAULT_RANGE);
  });
});

describe("usageHeroData", () => {
  it("is null without a report", () => {
    expect(usageHeroData(undefined)).toBeNull();
  });

  it("summarises the report for the usage card", () => {
    const data = usageHeroData(weekReport);
    expect(data?.totalTokens).toBe(weekReport.totals.totalTokens);
    expect(data?.daily).toHaveLength(weekReport.daily.length);
    expect(data?.empty).toBe(false);
  });
});
