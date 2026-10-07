import { describe, expect, it } from "vitest";
import { MAIN_WINDOW } from "./config";
import { parseWindowState, restoreWindow } from "./window-state";

const screen = { x: 0, y: 0, width: 1920, height: 1050 };
const second = { x: 1920, y: 0, width: 1280, height: 1000 };

describe("parseWindowState", () => {
  it("accepts a valid record and rounds the bounds", () => {
    expect(parseWindowState({ bounds: { x: 10.4, y: 20, width: 1200.6, height: 800 }, maximized: true })).toEqual({
      bounds: { x: 10, y: 20, width: 1201, height: 800 },
      maximized: true,
    });
  });

  it("rejects malformed records", () => {
    expect(parseWindowState(null)).toBeNull();
    expect(parseWindowState({ bounds: { x: 0, y: 0, width: "1", height: 2 } })).toBeNull();
    expect(parseWindowState({ bounds: { x: 0, y: 0, width: 0, height: 10 } })).toBeNull();
  });
});

describe("restoreWindow", () => {
  it("uses the default size without a saved state", () => {
    expect(restoreWindow(null, [screen], MAIN_WINDOW)).toEqual({ width: 1240, height: 800, maximized: false });
  });

  it("restores position, size and maximized on a visible display", () => {
    const saved = { bounds: { x: 2000, y: 40, width: 1000, height: 700 }, maximized: true };
    expect(restoreWindow(saved, [screen, second], MAIN_WINDOW)).toEqual({ x: 2000, y: 40, width: 1000, height: 700, maximized: true });
  });

  it("clamps the size to the display and the minimum size", () => {
    const huge = { bounds: { x: 0, y: 0, width: 5000, height: 3000 }, maximized: false };
    expect(restoreWindow(huge, [screen], MAIN_WINDOW)).toMatchObject({ x: 0, y: 0, width: 1920, height: 1050 });
    const tiny = { bounds: { x: 100, y: 100, width: 100, height: 100 }, maximized: false };
    expect(restoreWindow(tiny, [screen], MAIN_WINDOW)).toMatchObject({ width: 360, height: 480 });
  });

  it("centres a window whose display is gone", () => {
    const saved = { bounds: { x: 4000, y: 200, width: 1200, height: 800 }, maximized: false };
    const restored = restoreWindow(saved, [screen], MAIN_WINDOW);
    expect(restored.x).toBeUndefined();
    expect(restored.y).toBeUndefined();
    expect(restored).toMatchObject({ width: 1200, height: 800 });
  });

  it("pulls a partially visible window back on screen", () => {
    const saved = { bounds: { x: 1500, y: -20, width: 1000, height: 700 }, maximized: false };
    expect(restoreWindow(saved, [screen], MAIN_WINDOW)).toMatchObject({ x: 920, y: 0 });
  });
});
