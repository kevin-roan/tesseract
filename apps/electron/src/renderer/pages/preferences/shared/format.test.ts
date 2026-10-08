import { ApiError } from "@tesseract/client";
import { describe, expect, it } from "vitest";
import { capitalize, formatUptime, joinMeta, offlineMessage, pluralize, sandboxErrorMessage } from "./format";

describe("preferences format helpers", () => {
  it("formats durations like the GTK app", () => {
    expect(formatUptime(42)).toBe("42s");
    expect(formatUptime(600)).toBe("10m");
    expect(formatUptime(7140)).toBe("1h 59m");
    expect(formatUptime(7200)).toBe("2h");
    expect(formatUptime(90000)).toBe("1d 1h");
    expect(formatUptime(172800)).toBe("2d");
  });

  it("capitalizes plans and pluralizes counts", () => {
    expect(capitalize("max")).toBe("Max");
    expect(capitalize("team_pro-plan")).toBe("Team pro plan");
    expect(pluralize(1, "skill file")).toBe("1 skill file");
    expect(pluralize(2, "skill file")).toBe("2 skill files");
  });

  it("joins non-empty parts", () => {
    expect(joinMeta("a", null, "", "b", undefined)).toBe("a · b");
    expect(joinMeta()).toBe("");
  });

  it("maps a 404 to the outdated message", () => {
    expect(sandboxErrorMessage(new ApiError(404, "not_found", "Not found"), "too old")).toBe("too old");
    expect(sandboxErrorMessage(new Error("boom"), "too old")).toBe("boom");
  });

  it("appends the connection error", () => {
    expect(offlineMessage("tesseract-sandbox · Offline", "refused")).toBe("tesseract-sandbox · Offline — refused");
    expect(offlineMessage("Not configured", null)).toBe("Not configured");
  });
});
