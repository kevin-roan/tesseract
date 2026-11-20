import { describe, expect, it } from "vitest";
import { fitDeviceWindow } from "./device-fit";

const workArea = { width: 1920, height: 1080 };

describe("fitDeviceWindow", () => {
  it("shrinks a tall screen to the work area and keeps its aspect ratio", () => {
    const { size, chrome } = fitDeviceWindow({ width: 1080, height: 2400 }, workArea);
    expect(size.height).toBeLessThanOrEqual(workArea.height);
    expect((size.width - chrome.width) / (size.height - chrome.height)).toBeCloseTo(1080 / 2400, 2);
  });

  it("swaps the window's shape when the device rotates", () => {
    const { size } = fitDeviceWindow({ width: 2400, height: 1080 }, workArea);
    expect(size.width).toBeGreaterThan(size.height);
    expect(size.width).toBeLessThanOrEqual(workArea.width);
  });

  it("never scales a small screen past its native size", () => {
    const { size, chrome } = fitDeviceWindow({ width: 320, height: 480 }, workArea);
    expect(size).toEqual({ width: 320 + chrome.width, height: 480 + chrome.height });
  });
});
