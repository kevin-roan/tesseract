import { AppState, type AppStateStatus, type NativeEventSubscription } from "react-native";
import { create } from "zustand";

import type { HostSessionState } from "../types";
import { sessionRemainingMs } from "../utils/session";

type HostSessionStore = {
  current: HostSessionState | null;
  start: (session: HostSessionState) => void;
  clear: () => void;
};

let expiryTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;

function stopWatching(): void {
  if (expiryTimer !== null) clearTimeout(expiryTimer);
  expiryTimer = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
}

export const shouldLockOnAppState = (state: AppStateStatus): boolean => state === "background";

export const useHostSessionStore = create<HostSessionStore>()((set, get) => ({
  current: null,

  start: (session) => {
    stopWatching();
    const remaining = sessionRemainingMs(session);
    if (remaining <= 0) return set({ current: null });
    expiryTimer = setTimeout(() => get().clear(), remaining);
    appStateSubscription = AppState.addEventListener("change", (state) => {
      if (shouldLockOnAppState(state)) get().clear();
    });
    set({ current: session });
  },

  clear: () => {
    stopWatching();
    if (get().current) set({ current: null });
  },
}));
