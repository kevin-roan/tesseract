import { describe, expect, it } from "vitest";
import { compactNumber, formatDuration, formatRelativeTime, formatTokens, joinMeta, pluralize } from "./format";

const NOW = Date.parse("2026-09-23T12:00:00Z") / 1000;
const ago = (seconds: number) => new Date((NOW - seconds) * 1000).toISOString();

describe("format", () => {
  it("compacts numbers like the GTK app", () => {
    expect(compactNumber(0)).toBe("0");
    expect(compactNumber(999)).toBe("999");
    expect(compactNumber(80_400)).toBe("80.4k");
    expect(compactNumber(396_000)).toBe("396k");
    expect(compactNumber(1_600_000)).toBe("1.6M");
    expect(compactNumber(999_960)).toBe("1M");
    expect(formatTokens(1)).toBe("1 token");
    expect(formatTokens(0)).toBe("0 tokens");
    expect(formatTokens(null)).toBeNull();
  });

  it("formats relative times", () => {
    expect(formatRelativeTime(ago(30), NOW)).toBe("just now");
    expect(formatRelativeTime(ago(50), NOW)).toBe("1m ago");
    expect(formatRelativeTime(ago(11 * 60 + 20), NOW)).toBe("11m ago");
    expect(formatRelativeTime(ago(4 * 3600 + 100), NOW)).toBe("4h ago");
    expect(formatRelativeTime(ago(2 * 86_400), NOW)).toBe("2d ago");
    expect(formatRelativeTime("2026-09-01T10:00:00Z", NOW)).toBe("2026-09-01");
    expect(formatRelativeTime(null, NOW)).toBe("");
  });

  it("formats durations", () => {
    expect(formatDuration(22)).toBe("22s");
    expect(formatDuration(96)).toBe("1m 36s");
    expect(formatDuration(120)).toBe("2m");
    expect(formatDuration(3 * 3600 + 5 * 60)).toBe("3h 5m");
    expect(formatDuration(2 * 86_400 + 3600)).toBe("2d 1h");
  });

  it("joins meta and pluralizes", () => {
    expect(joinMeta("a", null, "", "b")).toBe("a · b");
    expect(pluralize(1, "conversation")).toBe("1 conversation");
    expect(pluralize(3, "conversation")).toBe("3 conversations");
  });
});
