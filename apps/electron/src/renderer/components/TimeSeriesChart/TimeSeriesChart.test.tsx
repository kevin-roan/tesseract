import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { hoverMoment, type Plot } from "./paint";
import { TimeSeriesChart } from "./TimeSeriesChart";
import type { ChartSeries } from "./types";

const series: ChartSeries[] = [
  { key: "a", label: "A", color: 0, points: [[10, 0.1], [20, 0.2], [30, null]] },
  { key: "b", label: "B", color: 1, points: [[25, 0.5]] },
];

const plot: Plot = { x0: 0, y0: 0, x1: 100, y1: 100, start: 0, end: 100, ceiling: 1 };

describe("TimeSeriesChart", () => {
  it("renders an accessible canvas at the requested height", () => {
    render(<TimeSeriesChart series={series} durationS={60} height={200} clock={() => 40} label="Resource history" />);
    const canvas = screen.getByRole("img", { name: "Resource history" });
    expect(canvas.tagName).toBe("CANVAS");
    expect(canvas.parentElement?.style.height).toBe("200px");
  });

  it("snaps hover to the nearest visible timestamp", () => {
    expect(hoverMoment(plot, { series, hidden: new Set() }, 24)).toBe(25);
    expect(hoverMoment(plot, { series, hidden: new Set(["b"]) }, 24)).toBe(20);
    expect(hoverMoment(plot, { series, hidden: new Set() }, 120)).toBeNull();
  });
});
