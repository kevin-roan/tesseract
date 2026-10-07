import { describe, expect, it } from "vitest";
import { computeTooltipPosition } from "./position";

const viewport = { width: 800, height: 600 };
const size = { width: 60, height: 26 };

describe("computeTooltipPosition", () => {
  it("centers below the anchor with the gap", () => {
    const anchor = { left: 100, top: 100, width: 28, height: 28 };
    expect(computeTooltipPosition(anchor, size, viewport, "bottom", 6, 8)).toEqual({ placement: "bottom", left: 84, top: 134 });
  });

  it("flips to the top when there is no room below", () => {
    const anchor = { left: 100, top: 580, width: 28, height: 16 };
    const result = computeTooltipPosition(anchor, size, viewport, "bottom", 6, 8);
    expect(result.placement).toBe("top");
    expect(result.top).toBe(580 - 6 - 26);
  });

  it("clamps horizontally inside the viewport margin", () => {
    const anchor = { left: 2, top: 100, width: 20, height: 20 };
    expect(computeTooltipPosition(anchor, size, viewport, "bottom", 6, 8).left).toBe(8);
    const right = { left: 790, top: 100, width: 10, height: 20 };
    expect(computeTooltipPosition(right, size, viewport, "bottom", 6, 8).left).toBe(800 - 8 - 60);
  });

  it("places left and right placements beside the anchor", () => {
    const anchor = { left: 300, top: 300, width: 20, height: 20 };
    expect(computeTooltipPosition(anchor, size, viewport, "right", 6, 8)).toEqual({ placement: "right", left: 326, top: 297 });
    expect(computeTooltipPosition(anchor, size, viewport, "left", 6, 8)).toEqual({ placement: "left", left: 234, top: 297 });
  });
});
