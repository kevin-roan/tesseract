import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DotSphere } from "./DotSphere";
import { bandOpacity, dotRadiusFor, frameAngle, sphereDots, spherePoints, TURN } from "./geometry";

describe("DotSphere geometry", () => {
  it("places points on a unit Fibonacci sphere", () => {
    const points = spherePoints(24);
    expect(points).toHaveLength(24);
    for (const point of points) expect(Math.hypot(point.x, point.y, point.z)).toBeCloseTo(1);
    expect(points[0]?.y).toBeCloseTo(1 - 1 / 24);
  });

  it("shades five depth bands", () => {
    expect([0, 1, 2, 3, 4].map((band) => Number(bandOpacity(band).toFixed(3)))).toEqual([0.208, 0.384, 0.56, 0.736, 0.912]);
  });

  it("quantizes the turn to 90 frames per period", () => {
    expect(frameAngle(0, 7200)).toBe(0);
    expect(frameAngle(79, 7200)).toBe(0);
    expect(frameAngle(80, 7200)).toBeCloseTo(TURN / 90);
    expect(frameAngle(7200, 7200)).toBe(0);
  });

  it("scales dots with depth and keeps them inside the box", () => {
    const radius = dotRadiusFor(20);
    expect(radius).toBe(1);
    expect(dotRadiusFor(40)).toBe(2);
    const dots = sphereDots(spherePoints(24), 0, 10, 10 - radius, radius);
    for (const dot of dots) {
      expect(dot.radius).toBeGreaterThanOrEqual(0.45 * radius - 1e-9);
      expect(dot.radius).toBeLessThanOrEqual(radius + 1e-9);
      expect(dot.band).toBeGreaterThanOrEqual(0);
      expect(dot.band).toBeLessThanOrEqual(4);
      expect(dot.x).toBeGreaterThanOrEqual(0);
      expect(dot.x).toBeLessThanOrEqual(20);
    }
  });

  it("renders a sized canvas", () => {
    const { container } = render(<DotSphere size={16} spinning label="Working" />);
    const canvas = container.querySelector("canvas");
    expect(canvas?.style.width).toBe("16px");
    expect(canvas?.getAttribute("aria-label")).toBe("Working");
    expect(canvas?.dataset.spinning).toBe("true");
  });
});
