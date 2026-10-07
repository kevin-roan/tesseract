import type { PollerTimers } from "./poller";

export interface ManualTimers {
  timers: PollerTimers;
  pending(): number[];
  fire(): void;
}

export function manualTimers(): ManualTimers {
  const queue = new Map<number, { callback: () => void; ms: number }>();
  let next = 0;
  return {
    timers: {
      set: (callback, ms) => {
        next += 1;
        queue.set(next, { callback, ms });
        return next;
      },
      clear: (handle) => {
        queue.delete(handle as number);
      },
    },
    pending: () => [...queue.values()].map((entry) => entry.ms),
    fire: () => {
      const entries = [...queue.values()];
      queue.clear();
      entries.forEach((entry) => entry.callback());
    },
  };
}

export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
