import { describe, expect, it } from "vitest";
import { keyboardWidth, resizeWidth } from "./model";

describe("resizeWidth", () => {
  it("clamps to 200-420 and rounds", () => {
    expect(resizeWidth(244, 10.4, 1)).toBe(254);
    expect(resizeWidth(244, -500, 1)).toBe(200);
    expect(resizeWidth(244, 500, 1)).toBe(420);
  });

  it("divides the offset by the zoom factor", () => {
    expect(resizeWidth(244, 40, 2)).toBe(264);
    expect(resizeWidth(244, 40, 0)).toBe(284);
  });
});

describe("keyboardWidth", () => {
  it("steps with arrows and jumps with Home/End", () => {
    expect(keyboardWidth("ArrowLeft", 244, 8)).toBe(236);
    expect(keyboardWidth("ArrowRight", 416, 8)).toBe(420);
    expect(keyboardWidth("Home", 300, 8)).toBe(200);
    expect(keyboardWidth("End", 300, 8)).toBe(420);
    expect(keyboardWidth("a", 300, 8)).toBeNull();
  });
});
