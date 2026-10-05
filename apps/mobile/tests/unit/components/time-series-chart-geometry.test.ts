import {
  areaPath,
  clockLabel,
  lastPoint,
  linePath,
  segments,
  timeTicks,
  valueMax,
  valueTicks,
  type ChartScale,
} from "@/components/time-series-chart/geometry";

const scale: ChartScale = { start: 0, end: 100, max: 1, frame: { left: 0, top: 0, width: 100, height: 100 } };

describe("time series geometry", () => {
  it("keeps the value axis at 100% unless a series overshoots", () => {
    expect(valueMax([[{ t: 0, value: 0.4 }]])).toBe(1);
    expect(valueMax([[{ t: 0, value: 1.1 }, { t: 1, value: null }]])).toBe(1.25);
    expect(valueTicks(1)).toEqual([1, 0.75, 0.5, 0.25, 0]);
  });

  it("splits runs at null values", () => {
    const runs = segments([{ t: 0, value: 1 }, { t: 1, value: null }, { t: 2, value: 0 }, { t: 3, value: 0.5 }]);
    expect(runs).toHaveLength(2);
    expect(runs[1]).toHaveLength(2);
  });

  it("draws lines and areas in plot coordinates", () => {
    const points = [{ t: 0, value: 0 }, { t: 50, value: 0.5 }, { t: 75, value: null }, { t: 100, value: 1 }];
    expect(linePath(scale, points)).toBe("M0.0,100.0L50.0,50.0M100.0,0.0L101.0,0.0");
    expect(areaPath(scale, points)).toBe("M0.0,100.0L0.0,100.0L50.0,50.0L50.0,100.0Z");
    expect(lastPoint(points)).toEqual({ t: 100, value: 1 });
    expect(lastPoint([{ t: 0, value: null }])).toBeNull();
  });

  it("places round clock ticks away from the right edge", () => {
    const minute = 60_000;
    const start = 10 * minute + 30_000;
    const ticks = timeTicks(start, start + 15 * minute);
    expect(ticks.length).toBeGreaterThan(0);
    ticks.forEach((tick) => expect(tick % (5 * minute)).toBe(0));
    expect(Math.max(...ticks)).toBeLessThan(start + 15 * minute * 0.88);
    expect(clockLabel(new Date(2026, 0, 1, 9, 5).getTime())).toBe("09:05");
  });
});
