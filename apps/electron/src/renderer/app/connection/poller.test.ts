import { describe, expect, it } from "vitest";
import { Poller } from "./poller";
import { deferred, flush, manualTimers } from "./test-helpers";

describe("Poller", () => {
  it("schedules the next tick after the fetch settles", async () => {
    const clock = manualTimers();
    const pending = deferred<number>();
    const results: number[] = [];
    const poller = new Poller({ fetch: () => pending.promise, intervalMs: 5_000, onResult: (value) => results.push(value), timers: clock.timers });
    poller.start();
    expect(clock.pending()).toEqual([]);
    pending.resolve(1);
    await flush();
    expect(results).toEqual([1]);
    expect(clock.pending()).toEqual([5_000]);
  });

  it("ignores refresh while a fetch is in flight", async () => {
    const clock = manualTimers();
    let calls = 0;
    const gate = deferred<void>();
    const poller = new Poller({
      fetch: async () => {
        calls += 1;
        await gate.promise;
      },
      intervalMs: 1_000,
      timers: clock.timers,
    });
    poller.start();
    poller.refresh();
    expect(calls).toBe(1);
    gate.resolve();
    await flush();
    poller.refresh();
    expect(calls).toBe(2);
  });

  it("reports errors and keeps polling", async () => {
    const clock = manualTimers();
    const errors: unknown[] = [];
    const poller = new Poller({ fetch: () => Promise.reject(new Error("x")), intervalMs: 2_000, onError: (error) => errors.push(error), timers: clock.timers });
    poller.start();
    await flush();
    expect(errors).toHaveLength(1);
    clock.fire();
    await flush();
    expect(errors).toHaveLength(2);
  });

  it("drops the in-flight result on stop and reports loading", async () => {
    const clock = manualTimers();
    const pending = deferred<number>();
    const loading: boolean[] = [];
    const results: number[] = [];
    const seen: { signal: AbortSignal | null } = { signal: null };
    const poller = new Poller({
      fetch: (s) => {
        seen.signal = s;
        return pending.promise;
      },
      intervalMs: 1_000,
      onResult: (value) => results.push(value),
      onLoading: (value) => loading.push(value),
      timers: clock.timers,
    });
    poller.start();
    poller.stop();
    expect(seen.signal?.aborted).toBe(true);
    pending.resolve(5);
    await flush();
    expect(results).toEqual([]);
    expect(loading).toEqual([true, false]);
    expect(clock.pending()).toEqual([]);
  });

  it("only reschedules on setInterval when a timer is pending", async () => {
    const clock = manualTimers();
    const poller = new Poller({ fetch: async () => 1, intervalMs: 5_000, timers: clock.timers });
    poller.setInterval(10_000);
    expect(clock.pending()).toEqual([]);
    poller.start(false);
    expect(clock.pending()).toEqual([10_000]);
    poller.setInterval(30_000);
    expect(clock.pending()).toEqual([30_000]);
  });
});
