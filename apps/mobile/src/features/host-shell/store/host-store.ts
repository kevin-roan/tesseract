import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import { listStorage } from "@/features/sandbox/store/list-storage";

import { getHostClient } from "../api/client";
import type { PairedHost } from "../types";
import { HOST_STORE_NAME, HOST_STORE_VERSION } from "../utils/constants";
import { HOST_NO_SANDBOX } from "../utils/content";
import { useHostSessionStore } from "./host-session-store";
import { hostTokenStorage } from "./host-token-storage";

type PersistedHostState = { hosts: Record<string, PairedHost> };

type LegacyHostState = { host?: PairedHost | null };

export type HostStore = PersistedHostState & {
  tokens: Record<string, string>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  pair: (input: { name: string; baseUrl: string; token: string }) => Promise<PairedHost>;
  unpair: () => Promise<void>;
  forget: (sandboxId: string) => Promise<void>;
};

let hydration: Promise<void> | null = null;

const without = <T>(record: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));

async function readTokens(sandboxIds: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(sandboxIds.map(async (id) => [id, await hostTokenStorage.read(id).catch(() => null)] as const));
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])));
}

async function adoptLegacyHost({ host }: LegacyHostState): Promise<PersistedHostState> {
  const { activeId, sandboxes } = useSandboxStore.getState();
  const owner = activeId ?? sandboxes[0]?.id ?? null;
  const token = await hostTokenStorage.readLegacy().catch(() => null);
  if (host && owner && token) await hostTokenStorage.write(owner, token);
  await hostTokenStorage.removeLegacy().catch(() => undefined);
  return { hosts: host && owner ? { [owner]: host } : {} };
}

function activeSandboxId(): string {
  const { activeId } = useSandboxStore.getState();
  if (!activeId) throw new Error(HOST_NO_SANDBOX);
  return activeId;
}

export const useHostStore = create<HostStore>()(
  persist(
    (set, get, api) => ({
      hosts: {},
      tokens: {},
      hydrated: false,

      hydrate: () => {
        if (get().hydrated) return Promise.resolve();
        hydration ??= (async () => {
          await useSandboxStore.getState().hydrate();
          await api.persist.rehydrate();
          const tokens = await readTokens(Object.keys(get().hosts));
          set({ tokens, hydrated: true });
        })().finally(() => {
          hydration = null;
        });
        return hydration;
      },

      pair: async ({ name, baseUrl, token }) => {
        await get().hydrate();
        const sandboxId = activeSandboxId();
        const host: PairedHost = { name, baseUrl, addedAt: new Date().toISOString() };
        await hostTokenStorage.write(sandboxId, token);
        useHostSessionStore.getState().clear();
        set((state) => ({ hosts: { ...state.hosts, [sandboxId]: host }, tokens: { ...state.tokens, [sandboxId]: token } }));
        return host;
      },

      unpair: async () => {
        const { activeId } = useSandboxStore.getState();
        useHostSessionStore.getState().clear();
        if (activeId) await get().forget(activeId);
      },

      forget: async (sandboxId) => {
        await get().hydrate();
        await hostTokenStorage.remove(sandboxId);
        set((state) => ({ hosts: without(state.hosts, sandboxId), tokens: without(state.tokens, sandboxId) }));
      },
    }),
    {
      name: HOST_STORE_NAME,
      version: HOST_STORE_VERSION,
      storage: createJSONStorage(() => listStorage),
      partialize: ({ hosts }): PersistedHostState => ({ hosts }),
      migrate: (persisted, version) =>
        version < 2 ? adoptLegacyHost(persisted as LegacyHostState) : (persisted as PersistedHostState),
      skipHydration: true,
    },
  ),
);

export const selectHost = (state: HostStore, sandboxId: string | null): PairedHost | null =>
  (sandboxId ? state.hosts[sandboxId] : undefined) ?? null;

export const selectHostToken = (state: HostStore, sandboxId: string | null): string | null =>
  (sandboxId ? state.tokens[sandboxId] : undefined) ?? null;

useSandboxStore.subscribe((state, previous) => {
  if (state.activeId === previous.activeId) return;
  const { current, clear } = useHostSessionStore.getState();
  if (!current) return;
  clear();
  const hosts = useHostStore.getState();
  const host = selectHost(hosts, previous.activeId);
  const token = selectHostToken(hosts, previous.activeId);
  if (host && token) getHostClient(host.baseUrl, token).lock(current.session).catch(() => undefined);
});
