import { buildAnalyticsView, comparisonCaption } from "@/features/analytics/utils/view-model";

import { datesEnding, day, emptyWeekReport, report, weekReport, weekSessions } from "./fixtures";

describe("buildAnalyticsView", () => {
  it("summarizes a week of usage", () => {
    const view = buildAnalyticsView({ days: 7, report: weekReport, sessions: weekSessions });
    expect(view.headline.value).toBe("11.6K");
    expect(view.headline.exact).toBe("11,550 tokens");
    expect(view.kpis.map((kpi) => [kpi.id, kpi.value])).toEqual([
      ["messages", "28"],
      ["sessions", "6"],
      ["cache", "63%"],
      ["output", "350"],
    ]);
    expect(view.kpis[3]).toMatchObject({ label: "Output tokens", caption: "Written by Claude" });
    expect(view.tokenBuckets).toHaveLength(7);
    expect(view.bucketSize).toBe(1);
    expect(view.models.map((model) => model.valueLabel)).toEqual(["9.5K", "2.1K"]);
    expect(view.topSessions.map((entry) => entry.sessionId)).toEqual(["s-big", "s-cli", "s-terminal"]);
    expect(view.heatmapSample).toBe(4);
  });

  it("compares against the previous equal period", () => {
    const dates = datesEnding("2026-09-24", 14);
    const comparison = report(dates.map((date, index) => day(date, index < 7 ? 1000 : 0, 0, 0, 0, index < 7 ? 2 : 0)));
    const current = report(dates.slice(7).map((date) => day(date, 1500, 0, 0, 0, 3)));
    const view = buildAnalyticsView({ days: 7, report: current, comparison });
    expect(view.headline.delta).toEqual({ kind: "up", ratio: 0.5 });
    expect(view.headline.caption).toBe("+50% vs the previous 7 days");
    expect(view.kpis[0].caption).toBe("+50% vs previous");
  });

  it("says when no comparison is possible", () => {
    expect(comparisonCaption(null, 90, false)).toBe("No comparison: history only goes back 90 days");
    expect(comparisonCaption(null, 7, true)).toBeNull();
    expect(comparisonCaption(null, 7, false)).toBe("No comparison available");
  });

  it("handles a range with no usage at all", () => {
    const view = buildAnalyticsView({ days: 7, report: emptyWeekReport });
    expect(view.headline.value).toBe("0");
    expect(view.kpis.find((kpi) => kpi.id === "cache")?.value).toBe("–");
    expect(view.models).toEqual([]);
    expect(view.projects).toEqual([]);
    expect(view.topSessions).toEqual([]);
    expect(view.heatmap.total).toBe(0);
  });

  it("buckets 90 days by week", () => {
    const long = report(datesEnding("2026-09-24", 90).map((date) => day(date, 1)));
    const view = buildAnalyticsView({ days: 90, report: long });
    expect(view.bucketSize).toBe(7);
    expect(view.tokenBuckets).toHaveLength(13);
    expect(view.tokenBuckets[0].values[0]).toBe(6);
    expect(view.headline.caption).toBe("No comparison: history only goes back 90 days");
  });
});
