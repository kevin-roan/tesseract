import { describe, expect, it } from "vitest";
import { formatBytes, formatPercent, keyValues, table } from "./format";

describe("formatBytes", () => {
  it("follows the shared byte format", () => {
    expect(formatBytes(null)).toBe("0 B");
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
    expect(formatBytes(150 * 1024 ** 3)).toBe("150 GB");
  });
});

describe("formatPercent", () => {
  it("clamps and rounds", () => {
    expect(formatPercent(0.456)).toBe("46%");
    expect(formatPercent(2)).toBe("100%");
    expect(formatPercent(null)).toBe("");
  });
});

describe("table", () => {
  it("pads every column but the last", () => {
    expect(table([["A", "LONG", "x"], ["BBB", "s", "y"]])).toEqual(["A    LONG  x", "BBB  s     y"]);
  });

  it("aligns key/value rows", () => {
    expect(keyValues([["Docker", "ok"], ["Sandbox", "down"]])).toEqual(["Docker:   ok", "Sandbox:  down"]);
  });
});
