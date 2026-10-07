import { describe, expect, it } from "vitest";
import { compactNumber, elapsedSeconds, formatBytes, formatDuration, formatTokens } from "./format";

describe("tab formatting", () => {
  it("formats bytes 1024-based", () => {
    expect(formatBytes(568)).toBe("568 B");
    expect(formatBytes(5530)).toBe("5.4 KB");
    expect(formatBytes(550_912)).toBe("538 KB");
    expect(formatBytes(73_400_320)).toBe("70 MB");
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(null)).toBe("0 B");
  });

  it("formats durations", () => {
    expect(formatDuration(1)).toBe("1s");
    expect(formatDuration(120)).toBe("2m");
    expect(formatDuration(14 * 60 + 58)).toBe("14m 58s");
    expect(formatDuration(3 * 3600 + 5 * 60)).toBe("3h 5m");
    expect(formatDuration(2 * 86_400 + 3600)).toBe("2d 1h");
  });

  it("measures elapsed time", () => {
    expect(elapsedSeconds("2026-09-23T10:00:00Z", "2026-09-23T10:00:30Z")).toBe(30);
    expect(elapsedSeconds(null, null)).toBeNull();
    expect(elapsedSeconds("2026-09-23T10:00:00Z", null, Date.parse("2026-09-23T10:01:00Z"))).toBe(60);
  });

  it("compacts token counts", () => {
    expect(compactNumber(999)).toBe("999");
    expect(compactNumber(12_345)).toBe("12.3k");
    expect(compactNumber(1_500_000)).toBe("1.5M");
    expect(formatTokens(12_345)).toBe("12.3k tokens");
    expect(formatTokens(1)).toBe("1 token");
    expect(formatTokens(null)).toBeNull();
  });
});
