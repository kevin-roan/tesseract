import {
  capitalize,
  clampFraction,
  elapsedSeconds,
  formatBytes,
  formatDuration,
  formatRelativeTime,
  formatUptime,
  formatUsageBreakdown,
  formatUsageTokens,
  pluralize,
  splitBytes,
} from "@/features/sandbox/utils/format";

const NOW = Date.parse("2026-09-23T12:00:00.000Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe("formatBytes", () => {
  it.each<[number, string]>([
    [0, "0 B"],
    [-5, "0 B"],
    [512, "512 B"],
    [1024, "1 KB"],
    [1536, "1.5 KB"],
    [73_400_320, "70 MB"],
    [16_000_000_000, "14.9 GB"],
    [500_000_000_000, "466 GB"],
    [2 * 1024 ** 4, "2 TB"],
  ])("formats %d as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it("splits value and unit for stat cards", () => {
    expect(splitBytes(4_000_000_000)).toEqual({ value: "3.7", unit: "GB" });
  });

  it("treats non-finite input as zero", () => {
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});

describe("formatUptime", () => {
  it.each<[number, string]>([
    [0, "0s"],
    [59, "59s"],
    [60, "1m"],
    [3599, "59m"],
    [3600, "1h"],
    [3600 + 12 * 60, "1h 12m"],
    [86_400, "1d"],
    [2 * 86_400 + 4 * 3600 + 59, "2d 4h"],
  ])("formats %d seconds as %s", (seconds, expected) => {
    expect(formatUptime(seconds)).toBe(expected);
  });
});

describe("formatDuration", () => {
  it("shows minutes and seconds for build-length durations", () => {
    expect(formatDuration(80)).toBe("1m 20s");
    expect(formatDuration(120)).toBe("2m");
    expect(formatDuration(4.4)).toBe("4s");
    expect(formatDuration(7200)).toBe("2h");
  });
});

describe("elapsedSeconds", () => {
  it("measures between two timestamps or until now", () => {
    expect(elapsedSeconds(ago(90), ago(30), NOW)).toBe(60);
    expect(elapsedSeconds(ago(90), null, NOW)).toBe(90);
  });

  it("returns null without a start or with bad input", () => {
    expect(elapsedSeconds(null, null, NOW)).toBeNull();
    expect(elapsedSeconds("not a date", null, NOW)).toBeNull();
  });
});

describe("formatRelativeTime", () => {
  it.each<[number, string]>([
    [5, "just now"],
    [44, "just now"],
    [60, "1m ago"],
    [59 * 60, "59m ago"],
    [3 * 3600, "3h ago"],
    [2 * 86_400, "2d ago"],
  ])("formats %d seconds ago as %s", (seconds, expected) => {
    expect(formatRelativeTime(ago(seconds), NOW)).toBe(expected);
  });

  it("falls back to the calendar date after a week", () => {
    expect(formatRelativeTime("2026-09-01T08:00:00.000Z", NOW)).toBe("2026-09-01");
  });

  it("clamps future timestamps to just now and ignores garbage", () => {
    expect(formatRelativeTime(ago(-120), NOW)).toBe("just now");
    expect(formatRelativeTime("garbage", NOW)).toBe("");
  });
});

describe("small formatters", () => {
  it("formats run token usage", () => {
    const usage = { inputTokens: 842, outputTokens: 12_300, cacheReadTokens: 1_200_000, cacheWriteTokens: 0, totalTokens: 1_213_142 };
    expect(formatUsageTokens(null)).toBeNull();
    expect(formatUsageTokens({ ...usage, totalTokens: 842 })).toBe("842 tokens");
    expect(formatUsageTokens({ ...usage, totalTokens: 12_300 })).toBe("12.3k tokens");
    expect(formatUsageTokens(usage)).toBe("1.2M tokens");
    expect(formatUsageBreakdown(null)).toBeNull();
    expect(formatUsageBreakdown(usage)).toBe("842 in · 12.3k out · 1.2M cache read");
    expect(formatUsageBreakdown({ ...usage, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 })).toBeNull();
  });

  it("clamps fractions", () => {
    expect(clampFraction(1.7)).toBe(1);
    expect(clampFraction(-1)).toBe(0);
    expect(clampFraction(Number.NaN)).toBe(0);
    expect(clampFraction(0.42)).toBe(0.42);
  });

  it("capitalizes protocol states", () => {
    expect(capitalize("running")).toBe("Running");
    expect(capitalize("tool_use")).toBe("Tool use");
    expect(capitalize("electron-windows")).toBe("Electron windows");
  });

  it("pluralizes counts", () => {
    expect(pluralize(1, "file")).toBe("1 file");
    expect(pluralize(3, "file")).toBe("3 files");
    expect(pluralize(2, "copy", "copies")).toBe("2 copies");
  });
});
