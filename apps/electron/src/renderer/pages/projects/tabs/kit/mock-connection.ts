import { useEffect } from "react";
import type { FakeClient } from "./testing";
import { asClient } from "./testing";

export function connectionMock(actual: object, client: () => FakeClient) {
  return {
    ...actual,
    useConnectionClient: () => asClient(client()),
    useWindowVisible: () => true,
    usePoller: (fetch: (signal: AbortSignal) => Promise<unknown>, _ms: number, options: { enabled?: boolean; onResult?(value: unknown): void }) => {
      useEffect(() => {
        if (options.enabled === false) return;
        void fetch(new AbortController().signal).then((value) => options.onResult?.(value));
      }, [options.enabled]);
      return { loading: false, refresh: () => undefined };
    },
  };
}
