import { describe, expect, it } from "vitest";
import {
  bezierControls,
  crisp,
  easeOut,
  monotoneTangents,
  nearest,
  niceCeiling,
  percentLabel,
  splitSegments,
  timeStep,
  timeTicks,
  valueTicks,
} from "./scale";
import { parseColor, withAlpha } from "./canvas";
import { Tween } from "./tween";

describe("y scale", () => {
  it("never drops below the floor and rounds peaks up to nice steps", () => {
    expect(niceCeiling(0.5)).toBe(1);
    expect(niceCeiling(Number.NaN)).toBe(1);
    expect(niceCeiling(1.1)).toBe(1.25);
    expect(niceCeiling(2.4)).toBe(3);
    expect(niceCeiling(9.5)).toBe(10);
    expect(niceCeiling(9.7)).toBe(12.5);
    expect(niceCeiling(0.3, 0.1)).toBe(0.4);
  });

  it("splits the ceiling into about four ticks", () => {
    expect(valueTicks(1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(valueTicks(1.25)).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25]);
    expect(valueTicks(3)).toEqual([0, 1, 2, 3]);
    expect(valueTicks(0)).toEqual([0]);
  });

  it("formats percentages", () => {
    expect(percentLabel(0.851)).toBe("85%");
    expect(percentLabel(0.5, 1)).toBe("50.0%");
  });
});

describe("time axis", () => {
  it("picks the first step that fits the tick budget", () => {
    expect(timeStep(900, 9)).toBe(120);
    expect(timeStep(300, 9)).toBe(60);
    expect(timeStep(3600, 9)).toBe(600);
    expect(timeStep(10 * 86400, 1)).toBe(7200);
  });

  it("aligns ticks to wall-clock multiples of the step", () => {
    expect(timeTicks(1000, 1300, 3, 0)).toEqual([1080, 1200]);
    expect(timeTicks(1000, 1300, 9, 0)).toEqual([1020, 1080, 1140, 1200, 1260]);
    expect(timeTicks(10, 5, 4, 0)).toEqual([]);
  });
});

describe("curves", () => {
  it("splits on null and non-finite values", () => {
    expect(
      splitSegments([
        [1, 0.1],
        [2, null],
        [3, 0.3],
        [4, Number.NaN],
        [5, 0.5],
        [6, 0.6],
      ]),
    ).toEqual([[[1, 0.1]], [[3, 0.3]], [[5, 0.5], [6, 0.6]]]);
  });

  it("keeps monotone data monotone (flat secants and extrema get zero tangents)", () => {
    const tangents = monotoneTangents([
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 0],
    ]);
    expect(tangents[1]).toBe(0);
    expect(tangents[2]).toBe(0);
    const curves = bezierControls([
      [0, 0],
      [3, 3],
    ]);
    expect(curves).toEqual([
      [
        [1, 1],
        [2, 2],
        [3, 3],
      ],
    ]);
  });

  it("limits steep tangents", () => {
    const tangents = monotoneTangents([
      [0, 0],
      [1, 0.01],
      [2, 10],
    ]);
    expect(Math.abs(tangents[1] ?? 0)).toBeLessThanOrEqual(3 * 0.01 + 1e-9);
  });
});

describe("helpers", () => {
  it("finds the nearest timestamp", () => {
    expect(nearest([], 3)).toBeNull();
    expect(nearest([1, 5, 9], 0)).toBe(0);
    expect(nearest([1, 5, 9], 6)).toBe(1);
    expect(nearest([1, 5, 9], 8)).toBe(2);
    expect(nearest([1, 5, 9], 20)).toBe(2);
  });

  it("snaps odd-width lines to half pixels", () => {
    expect(crisp(10.2, 1)).toBe(10.5);
    expect(crisp(10.2, 2)).toBe(10.0);
  });

  it("eases out cubically", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(0.5)).toBeCloseTo(0.875);
    expect(easeOut(2)).toBe(1);
  });

  it("parses colors and applies alpha", () => {
    expect(parseColor("#5E6AD2")).toEqual([94, 106, 210, 1]);
    expect(parseColor("rgba(255, 255, 255, 0.08)")).toEqual([255, 255, 255, 0.08]);
    expect(withAlpha("#ffffff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(withAlpha("rgba(0, 0, 0, 0.5)", 0.5)).toBe("rgba(0, 0, 0, 0.25)");
    expect(withAlpha("transparent", 0.5)).toBe("transparent");
  });
});

describe("Tween", () => {
  it("animates toward the target and retargets from the current value", () => {
    const tween = new Tween(0, 1);
    tween.set(1, 0);
    expect(tween.value(0.5)).toBeCloseTo(0.875);
    expect(tween.running(0.5)).toBe(true);
    tween.set(0, 0.5);
    expect(tween.value(0.5)).toBeCloseTo(0.875);
    expect(tween.value(2)).toBe(0);
    expect(tween.running(2)).toBe(false);
  });

  it("jumps when animation is off", () => {
    const tween = new Tween(0, 1);
    tween.set(5, 0, false);
    expect(tween.value(0)).toBe(5);
    expect(tween.running(0)).toBe(false);
  });
});
