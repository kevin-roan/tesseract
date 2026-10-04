import { renderHook } from "@testing-library/react-native";
import { FadeIn, FadeOut } from "react-native-reanimated";

import { useEntrance } from "@/hooks/use-entrance";
import { useLayoutMotion } from "@/hooks/use-layout-motion";

describe("useLayoutMotion", () => {
  it("fades in and out and keeps a stable config across renders", async () => {
    const { result, rerender } = await renderHook(() => useLayoutMotion());
    const first = result.current;
    expect(first.fadeIn).toBeInstanceOf(FadeIn);
    expect(first.fadeOut).toBeInstanceOf(FadeOut);
    await rerender({});
    expect(result.current).toBe(first);
  });
});

describe("useEntrance", () => {
  it("caps the stagger so late items do not wait", async () => {
    const tenth = await renderHook(() => useEntrance(10));
    const hundredth = await renderHook(() => useEntrance(100));
    const delay = (entering: unknown) => (entering as { delayV: number }).delayV;
    expect(delay(hundredth.result.current)).toBe(delay(tenth.result.current));
    expect(delay(tenth.result.current)).toBeGreaterThan(delay((await renderHook(() => useEntrance(0))).result.current));
  });
});
