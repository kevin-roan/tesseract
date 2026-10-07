import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { viewDirection } from "./direction";
import { useViewDirection } from "./use-view-direction";

describe("view direction", () => {
  it("pushes forward, pops back and replaces in place", () => {
    expect(viewDirection(0, 1)).toBe("forward");
    expect(viewDirection(2, 1)).toBe("back");
    expect(viewDirection(1, 1)).toBe("none");
  });

  it("derives the direction from depth changes between views", () => {
    const { result, rerender } = renderHook(({ key, depth }) => useViewDirection(key, depth), { initialProps: { key: "root", depth: 0 } });
    expect(result.current).toBe("none");
    rerender({ key: "detail", depth: 1 });
    expect(result.current).toBe("forward");
    rerender({ key: "detail", depth: 1 });
    expect(result.current).toBe("forward");
    rerender({ key: "root", depth: 0 });
    expect(result.current).toBe("back");
    rerender({ key: "files", depth: 0 });
    expect(result.current).toBe("none");
  });
});
