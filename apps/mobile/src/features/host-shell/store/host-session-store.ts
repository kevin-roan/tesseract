import { create } from "zustand";

import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import type { HostSessionState } from "../types";
import { sessionRemainingMs } from "../utils/session";
import { hostSessionStorage } from "./host-session-storage";

type HostSessionStore = {
  current: HostSessionState | null;
  /** A fresh unlock for the active sandbox's host: kept (in the keychain) until it expires or is locked. */
  start: (session: HostSessionState) => void;
  /** Takes up the session a previous run of the app kept for this sandbox, if it has not expired. */
  restore: (sandboxId: string) => Promise<void>;
  clear: () => void;
};

let expiryTimer: ReturnType<typeof setTimeout> | null = null;
/** The sandbox whose host the current session unlocks. */
let owner: string | null = null;

function stopTimer(): void {
  if (expiryTimer !== null) clearTimeout(expiryTimer);
  expiryTimer = null;
}

export const useHostSessionStore = create<HostSessionStore>()((set, get) => {
  /** The session stays unlocked in the background too; it ends at `expiresAt`, on `clear`, or when the host refuses it. */
  const take = (session: HostSessionState, sandboxId: string | null): boolean => {
    stopTimer();
    const remaining = sessionRemainingMs(session);
    if (remaining <= 0) {
      owner = null;
      set({ current: null });
      return false;
    }
    owner = sandboxId;
    expiryTimer = setTimeout(() => get().clear(), remaining);
    set({ current: session });
    return true;
  };

  return {
    current: null,

    start: (session) => {
      const sandboxId = useSandboxStore.getState().activeId;
      if (take(session, sandboxId) && sandboxId) hostSessionStorage.write(sandboxId, session).catch(() => undefined);
    },

    restore: async (sandboxId) => {
      if (get().current) return;
      const saved = await hostSessionStorage.read(sandboxId).catch(() => null);
      if (!saved || get().current || useSandboxStore.getState().activeId !== sandboxId) return;
      if (!take(saved, sandboxId)) hostSessionStorage.remove(sandboxId).catch(() => undefined);
    },

    clear: () => {
      stopTimer();
      if (owner) hostSessionStorage.remove(owner).catch(() => undefined);
      owner = null;
      if (get().current) set({ current: null });
    },
  };
});
