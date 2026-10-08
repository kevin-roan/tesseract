import { sampleDisplay } from "@tesseract/protocol/fixtures";

import { displayInsets, displayOutage, displaySubtitle, nextInputMode } from "@/features/sandbox/utils/display";

describe("displayOutage", () => {
  it("is null until the status is known and when everything is up", () => {
    expect(displayOutage(undefined)).toBeNull();
    expect(displayOutage(sampleDisplay)).toBeNull();
  });

  it("blames the X display first, then VNC", () => {
    const bothDown = { ...sampleDisplay, available: false, vnc: { ...sampleDisplay.vnc, available: false } };
    expect(displayOutage(bothDown)?.reason).toBe("display");
    const vncDown = { ...sampleDisplay, vnc: { ...sampleDisplay.vnc, available: false } };
    expect(displayOutage(vncDown)).toMatchObject({ reason: "vnc", title: "VNC is not running" });
    expect(displayOutage(vncDown)?.message).toContain("VNC port 5901");
  });
});

describe("displaySubtitle", () => {
  it("includes the geometry when the display reports one", () => {
    expect(displaySubtitle(sampleDisplay)).toBe(":1 · 1600×900");
    expect(displaySubtitle({ ...sampleDisplay, width: null, height: null })).toBe(":1");
    expect(displaySubtitle(undefined)).toBeUndefined();
  });
});

describe("displayInsets", () => {
  it("clears the floating bar at the top and the home indicator at the bottom", () => {
    expect(displayInsets({ barBottom: 111.4, safeBottom: 34, fullscreen: false })).toEqual({ top: 112, bottom: 34 });
  });

  it("needs no insets in full screen, where the stage already sits inside the safe area", () => {
    expect(displayInsets({ barBottom: 111, safeBottom: 21, fullscreen: true })).toEqual({ top: 0, bottom: 0 });
  });

  it("never reports negative insets", () => {
    expect(displayInsets({ barBottom: -4, safeBottom: -1, fullscreen: false })).toEqual({ top: 0, bottom: 0 });
  });
});

describe("nextInputMode", () => {
  it("flips between trackpad and touch", () => {
    expect(nextInputMode("trackpad")).toBe("touch");
    expect(nextInputMode("touch")).toBe("trackpad");
  });
});
