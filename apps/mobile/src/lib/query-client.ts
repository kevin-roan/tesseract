import { AppState, Platform } from "react-native";
import { QueryClient, focusManager, onlineManager } from "@tanstack/react-query";
import * as Network from "expo-network";

const STALE_TIME_MS = 5_000;
const MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 8_000;

export function createQueryClient(shouldRetry: (error: unknown) => boolean = () => true): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        retry: (failureCount, error) => failureCount < MAX_RETRIES && shouldRetry(error),
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, MAX_RETRY_DELAY_MS),
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** The browser defaults (visibilitychange / online events) already work on web. */
export function bindQueryManagers(): void {
  if (Platform.OS === "web") return;

  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener("change", (state) => setFocused(state === "active"));
    return () => subscription.remove();
  });

  onlineManager.setEventListener((setOnline) => {
    let received = false;
    const subscription = Network.addNetworkStateListener((state) => {
      received = true;
      setOnline(state.isConnected !== false);
    });
    Network.getNetworkStateAsync()
      .then((state) => {
        if (!received) setOnline(state.isConnected !== false);
      })
      .catch(() => undefined);
    return () => subscription.remove();
  });
}
