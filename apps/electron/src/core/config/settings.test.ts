import { describe, expect, it } from "vitest";
import { applySettingsPatch, clampSidebarWidth, settingsFromConfig, stepZoom } from "./settings";

describe("settings", () => {
  it("steps zoom like the GTK app", () => {
    expect(stepZoom(1, 1)).toBe(1.1);
    expect(stepZoom(1, -1)).toBe(0.9);
    expect(stepZoom(2, 1)).toBe(2);
    expect(stepZoom(0.67, -1)).toBe(0.67);
    expect(stepZoom(1.5, 0)).toBe(1);
  });

  it("clamps the sidebar width and ignores non-numbers", () => {
    expect(clampSidebarWidth(100)).toBe(200);
    expect(clampSidebarWidth(900)).toBe(420);
    expect(clampSidebarWidth(true)).toBe(244);
  });

  it("reads and writes the GTK keys", () => {
    const data = applySettingsPatch({ url: "x" }, { hostShellAutostart: true, appearance: "light" });
    expect(data).toEqual({ url: "x", host_shell_autostart: true, appearance: "light" });
    expect(settingsFromConfig(data)).toMatchObject({ appearance: "light", hostShellAutostart: true, zoom: 1 });
  });
});
