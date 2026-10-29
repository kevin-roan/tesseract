import { describe, expect, it } from "vitest";
import { AUTOMATIC, CUSTOM, pickChanged, pickedPath, savedPick, toolchainChoices, toolchainMissing, type ToolchainSection } from "./model";

const SDK = "/Users/me/Library/Android/sdk";
const section = (patch: Partial<ToolchainSection> = {}): ToolchainSection => ({
  configured: null,
  path: SDK,
  source: "detected",
  candidates: [{ path: SDK, label: "Android Studio", usable: true }],
  ...patch,
});

describe("remote toolchain model", () => {
  it("offers automatic, the found folders and a custom folder", () => {
    expect(toolchainChoices(section(), "android")).toEqual([
      { id: AUTOMATIC, title: "Automatic", subtitle: `Found on the host · ${SDK}` },
      { id: SDK, title: "Android Studio", subtitle: `${SDK} · Has platform-tools` },
      { id: CUSTOM, title: "Another folder", subtitle: "An absolute path on the host" },
    ]);
  });

  it("maps the saved folder to a choice", () => {
    expect(savedPick(section())).toEqual({ choice: AUTOMATIC, custom: "" });
    expect(savedPick(section({ configured: SDK }))).toEqual({ choice: SDK, custom: "" });
    expect(savedPick(section({ configured: "/opt/sdk" }))).toEqual({ choice: CUSTOM, custom: "/opt/sdk" });
  });

  it("only saves a real change", () => {
    expect(pickedPath({ choice: CUSTOM, custom: "  " })).toBeUndefined();
    expect(pickChanged(section(), { choice: AUTOMATIC, custom: "" })).toBe(false);
    expect(pickChanged(section(), { choice: SDK, custom: "" })).toBe(true);
    expect(pickChanged(section({ configured: "/opt/sdk" }), { choice: CUSTOM, custom: "/opt/sdk " })).toBe(false);
  });

  it("flags a missing or unusable SDK", () => {
    expect(toolchainMissing(section())).toBe(false);
    expect(toolchainMissing(section({ path: null, source: null }))).toBe(true);
    expect(toolchainMissing(section({ candidates: [{ path: SDK, label: "Android Studio", usable: false }] }))).toBe(true);
  });
});
