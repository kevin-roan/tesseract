import { act, renderHook } from "@testing-library/react-native";

import { useStreamBuffer } from "@/features/sandbox/hooks/use-stream-buffer";
import { STREAM_FLUSH_INTERVAL_MS } from "@/features/sandbox/utils/constants";

const append = (current: number[], incoming: number[]) => [...current, ...incoming];

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useStreamBuffer", () => {
  it("batches pushes into one flush per interval", async () => {
    const merge = jest.fn(append);
    const { result } = await renderHook(() => useStreamBuffer("a", merge));

    await act(async () => {
      result.current.push("a", [1]);
      result.current.push("a", [2, 3]);
    });
    expect(result.current.items).toEqual([]);

    await act(async () => jest.advanceTimersByTime(STREAM_FLUSH_INTERVAL_MS));
    expect(result.current.items).toEqual([1, 2, 3]);
    expect(merge).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.push("a", [4]);
      jest.advanceTimersByTime(STREAM_FLUSH_INTERVAL_MS);
    });
    expect(result.current.items).toEqual([1, 2, 3, 4]);
  });

  it("drops items buffered for a previous key and hides stale state", async () => {
    const { result, rerender } = await renderHook(({ key }: { key: string }) => useStreamBuffer(key, append), {
      initialProps: { key: "a" },
    });

    await act(async () => {
      result.current.push("a", [1]);
      jest.advanceTimersByTime(STREAM_FLUSH_INTERVAL_MS);
    });
    await rerender({ key: "b" });
    expect(result.current.items).toEqual([]);

    await act(async () => {
      result.current.push("a", [2]);
      result.current.push("b", [9]);
      jest.advanceTimersByTime(STREAM_FLUSH_INTERVAL_MS);
    });
    expect(result.current.items).toEqual([9]);
  });

  it("uses the latest merge function and clears its timer on unmount", async () => {
    const { result, rerender, unmount } = await renderHook(
      ({ merge }: { merge: (current: number[], incoming: number[]) => number[] }) => useStreamBuffer("a", merge),
      { initialProps: { merge: append } },
    );
    const reversed = jest.fn((current: number[], incoming: number[]) => [...incoming, ...current]);
    await rerender({ merge: reversed });

    await act(async () => {
      result.current.push("a", [1]);
      jest.advanceTimersByTime(STREAM_FLUSH_INTERVAL_MS);
    });
    expect(reversed).toHaveBeenCalled();

    const setTimer = jest.spyOn(globalThis, "setTimeout");
    const clearTimer = jest.spyOn(globalThis, "clearTimeout");
    await act(async () => result.current.push("a", [2]));
    const flushTimer = setTimer.mock.results.find((entry) => entry.type === "return")?.value;
    await unmount();
    expect(clearTimer).toHaveBeenCalledWith(flushTimer);
    setTimer.mockRestore();
    clearTimer.mockRestore();
  });
});
