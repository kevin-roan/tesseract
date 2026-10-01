import { clampProgress, percentLabel, progressPercent } from "@/lib/progress";

describe("progress helpers", () => {
  it.each([
    [-0.2, 0],
    [0.426, 0.426],
    [1.4, 1],
    [Number.NaN, 0],
  ])("clamps %p to %p", (value, expected) => {
    expect(clampProgress(value)).toBe(expected);
  });

  it("rounds to a whole percentage label", () => {
    expect(progressPercent(0.726)).toBe(73);
    expect(percentLabel(1)).toBe("100%");
    expect(percentLabel(2)).toBe("100%");
  });
});
