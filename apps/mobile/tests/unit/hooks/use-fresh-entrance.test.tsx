import { renderHook } from "@testing-library/react-native";

import { useFreshEntrance } from "@/hooks/use-fresh-entrance";

describe("useFreshEntrance", () => {
  it("animates nothing until the run has loaded", async () => {
    const { result } = await renderHook(() => useFreshEntrance([1, 2], false));
    expect(result.current(3)).toBeUndefined();
  });

  it("keeps rows that were already there still and animates new ones once", async () => {
    const renders: unknown[] = [];
    const { result, rerender } = await renderHook(
      ({ keys }: { keys: number[] }) => {
        const entranceFor = useFreshEntrance(keys, true);
        if (keys.includes(3)) renders.push(entranceFor(3));
        return entranceFor;
      },
      { initialProps: { keys: [1, 2] } },
    );
    expect(result.current(1)).toBeUndefined();
    expect(result.current(2)).toBeUndefined();

    await rerender({ keys: [1, 2, 3] });
    expect(renders[0]).toBeDefined();
    expect(result.current(3)).toBeUndefined();
  });

  it("animates every streamed row when the run started empty", async () => {
    const { result } = await renderHook(() => useFreshEntrance([], true));
    expect(result.current(0)).toBeDefined();
  });
});
