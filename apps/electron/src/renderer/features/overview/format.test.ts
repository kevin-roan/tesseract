import { describe, expect, it } from "vitest";
import { formatBytes, formatLoad, formatRelativeTime, formatUptime, joinMeta, percentLabel, pluralize, ratio, splitBytes } from "./format";

describe("overview format helpers", () => {
  it("formats uptime like the GTK app", () => {
    expect(formatUptime(42)).toBe("42s");
    expect(formatUptime(125)).toBe("2m");
    expect(formatUptime(7 * 3600 + 46 * 60 + 5)).toBe("7h 46m");
    expect(formatUptime(3 * 3600)).toBe("3h");
    expect(formatUptime(2 * 86400 + 5 * 3600)).toBe("2d 5h");
    expect(formatUptime(86400)).toBe("1d");
    expect(formatUptime(-4)).toBe("0s");
  });

  it("splits bytes into value and unit", () => {
    expect(splitBytes(0)).toEqual({ value: "0", unit: "B" });
    expect(splitBytes(Number.NaN)).toEqual({ value: "0", unit: "B" });
    expect(splitBytes(512)).toEqual({ value: "512", unit: "B" });
    expect(splitBytes(6.3 * 1024 ** 3)).toEqual({ value: "6.3", unit: "GB" });
    expect(splitBytes(8 * 1024 ** 3)).toEqual({ value: "8", unit: "GB" });
    expect(splitBytes(150.4 * 1024 ** 2)).toEqual({ value: "150", unit: "MB" });
    expect(formatBytes(100 * 1024 ** 3)).toBe("100 GB");
  });

  it("formats relative times", () => {
    const now = Date.parse("2026-10-07T12:00:00Z") / 1000;
    expect(formatRelativeTime("2026-10-07T11:59:30Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-10-07T11:57:00Z", now)).toBe("3m ago");
    expect(formatRelativeTime("2026-10-07T04:14:00Z", now)).toBe("7h ago");
    expect(formatRelativeTime("2026-10-04T12:00:00Z", now)).toBe("3d ago");
    expect(formatRelativeTime("2026-09-01T12:00:00Z", now)).toBe("2026-09-01");
    expect(formatRelativeTime("nope", now)).toBe("");
    expect(formatRelativeTime(null, now)).toBe("");
  });

  it("formats loads, percents, plurals and meta lines", () => {
    expect(formatLoad(11.987)).toBe("11.99");
    expect(percentLabel(0.79)).toBe("79%");
    expect(percentLabel(3)).toBe("300%");
    expect(pluralize(1, "session")).toBe("1 session");
    expect(pluralize(3, "session")).toBe("3 sessions");
    expect(joinMeta("up 7h", "", null, "v0.1.0")).toBe("up 7h · v0.1.0");
    expect(ratio(5, 4)).toBe(1);
    expect(ratio(1, 0)).toBeNull();
  });
});
