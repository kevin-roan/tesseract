import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sparklinePoints } from "./geometry";
import { Sparkline } from "./Sparkline";

describe("sparklinePoints", () => {
  it("needs at least two values", () => {
    expect(sparklinePoints({ values: [1], width: 100, height: 36, maxPoints: 60, min: 0, max: null })).toEqual([]);
  });

  it("grows from the right edge with a fixed step and inset", () => {
    const points = sparklinePoints({ values: [0, 1], width: 118, height: 36, maxPoints: 60, min: 0, max: null });
    expect(points).toHaveLength(2);
    expect(points[1]?.[0]).toBe(118);
    expect(points[0]?.[0]).toBeCloseTo(116);
    expect(points[0]?.[1]).toBeCloseTo(36 - 1.75);
    expect(points[1]?.[1]).toBeCloseTo(1.75);
  });

  it("clamps to the range and keeps only the last maxPoints values", () => {
    const points = sparklinePoints({ values: [5, -1, 2, 0.5], width: 30, height: 10, maxPoints: 3, min: 0, max: 1 });
    expect(points).toHaveLength(3);
    expect(points[0]?.[0]).toBe(0);
    expect(points[1]?.[1]).toBeCloseTo(1.75);
  });

  it("renders at the requested height", () => {
    const { container } = render(<Sparkline values={[0, 1, 0]} height={40} label="CPU" />);
    expect((container.firstChild as HTMLElement).style.height).toBe("40px");
  });
});
