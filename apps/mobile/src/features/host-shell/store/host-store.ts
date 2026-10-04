import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { listStorage } from "@/features/sandbox/store/list-storage";

import type { PairedHost } from "../types";
import { HOST_STORE_NAME, HOST_STORE_VERSION } from "../utils/constants";
import { useHostSessionStore } from "./host-session-store";
import { hostTokenStorage } from "./host-token-storage";

type PersistedHostState = { host: PairedHost | null };

export type HostStore = PersistedHostState & {
  token: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  pair: (input: { name: string; baseUrl: string; token: string }) => Promise<PairedHost>;
  unpair: () => Promise<void>;
};

let hydration: Promise<void> | null = null;

export const useHostStore = create<HostStore>()(
  persist(
    (set, get, api) => ({
      host: null,
      token: null,
      hydrated: false,

      hydrate: () => {
        if (get().hydrated) return Promise.resolve();
        hydration ??= (async () => {
          await api.persist.rehydrate();
          const token = get().host ? await hostTokenStorage.read().catch(() => null) : null;
          set({ token, hydrated: true });
        })().finally(() => {
          hydration = null;
        });
        return hydration;
      },

      pair: async ({ name, baseUrl, token }) => {
        await get().hydrate();
        const host: PairedHost = { name, baseUrl, addedAt: new Date().toISOString() };
        await hostTokenStorage.write(token);
        useHostSessionStore.getState().clear();
        set({ host, token });
        return host;
      },

      unpair: async () => {
        await hostTokenStorage.remove();
        useHostSessionStore.getState().clear();
        set({ host: null, token: null });
      },
    }),
    {
      name: HOST_STORE_NAME,
      version: HOST_STORE_VERSION,
      storage: createJSONStorage(() => listStorage),
      partialize: ({ host }): PersistedHostState => ({ host }),
      skipHydration: true,
    },
  ),
);
