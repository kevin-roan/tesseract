import { sampleDisplay } from "@theone/protocol/fixtures";

import { displayOutage, displaySubtitle } from "@/features/sandbox/utils/display";

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
