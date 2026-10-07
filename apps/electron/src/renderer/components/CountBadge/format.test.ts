import { describe, expect, it } from "vitest";
import { formatCount } from "./format";

describe("formatCount", () => {
  it("hides empty counts and caps at max", () => {
    expect(formatCount(0, 99)).toBeNull();
    expect(formatCount(null, 99)).toBeNull();
    expect(formatCount(undefined, 99)).toBeNull();
    expect(formatCount(7, 99)).toBe("7");
    expect(formatCount(99, 99)).toBe("99");
    expect(formatCount(100, 99)).toBe("99+");
  });
});
