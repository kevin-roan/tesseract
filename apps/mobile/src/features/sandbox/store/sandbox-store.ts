import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { NewSandbox, PairedSandbox } from "../types";
import { SANDBOX_STORE_NAME, SANDBOX_STORE_VERSION } from "../utils/constants";
import { createSandboxId } from "../utils/identity";
import { listStorage } from "./list-storage";
import { tokenStorage } from "./token-storage";

export type PersistedSandboxState = {
  sandboxes: PairedSandbox[];
  activeId: string | null;
};

export type SandboxStore = PersistedSandboxState & {
  tokens: Record<string, string>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addSandbox: (input: NewSandbox) => Promise<PairedSandbox>;
  removeSandbox: (id: string) => Promise<void>;
  renameSandbox: (id: string, name: string) => void;
  setActive: (id: string) => void;
};

let hydration: Promise<void> | null = null;

async function readTokens(sandboxes: PairedSandbox[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    sandboxes.map(async ({ id }) => [id, await tokenStorage.read(id).catch(() => null)] as const),
  );
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])));
}

function resolveActiveId(sandboxes: PairedSandbox[], activeId: string | null): string | null {
  if (activeId && sandboxes.some((sandbox) => sandbox.id === activeId)) return activeId;
  return sandboxes[0]?.id ?? null;
}

export const useSandboxStore = create<SandboxStore>()(
  persist(
    (set, get, api) => ({
      sandboxes: [],
      activeId: null,
      tokens: {},
      hydrated: false,

      hydrate: () => {
        if (get().hydrated) return Promise.resolve();
        hydration ??= (async () => {
          await api.persist.rehydrate();
          const { sandboxes, activeId } = get();
          const tokens = await readTokens(sandboxes);
          set({ tokens, hydrated: true, activeId: resolveActiveId(sandboxes, activeId) });
        })().finally(() => {
          hydration = null;
        });
        return hydration;
      },

      addSandbox: async ({ name, baseUrl, token }) => {
        // persist writes on every set, so saving before hydration would overwrite the stored list.
        await get().hydrate();
        const existing = get().sandboxes.find((sandbox) => sandbox.baseUrl === baseUrl);
        const sandbox: PairedSandbox = existing
          ? { ...existing, name }
          : { id: createSandboxId(), name, baseUrl, addedAt: new Date().toISOString() };
        await tokenStorage.write(sandbox.id, token);
        set((state) => ({
          sandboxes: existing
            ? state.sandboxes.map((entry) => (entry.id === sandbox.id ? sandbox : entry))
            : [...state.sandboxes, sandbox],
          tokens: { ...state.tokens, [sandbox.id]: token },
          activeId: sandbox.id,
        }));
        return sandbox;
      },

      removeSandbox: async (id) => {
        await tokenStorage.remove(id);
        set((state) => {
          const sandboxes = state.sandboxes.filter((sandbox) => sandbox.id !== id);
          const tokens = Object.fromEntries(Object.entries(state.tokens).filter(([key]) => key !== id));
          return { sandboxes, tokens, activeId: resolveActiveId(sandboxes, state.activeId === id ? null : state.activeId) };
        });
      },

      renameSandbox: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          sandboxes: state.sandboxes.map((sandbox) => (sandbox.id === id ? { ...sandbox, name: trimmed } : sandbox)),
        }));
      },

      setActive: (id) => {
        if (get().sandboxes.some((sandbox) => sandbox.id === id)) set({ activeId: id });
      },
    }),
    {
      name: SANDBOX_STORE_NAME,
      version: SANDBOX_STORE_VERSION,
      storage: createJSONStorage(() => listStorage),
      partialize: ({ sandboxes, activeId }): PersistedSandboxState => ({ sandboxes, activeId }),
      skipHydration: true,
    },
  ),
);

export const selectActiveSandbox = (state: SandboxStore): PairedSandbox | null =>
  state.sandboxes.find((sandbox) => sandbox.id === state.activeId) ?? null;

export const selectActiveToken = (state: SandboxStore): string | null =>
  (state.activeId ? state.tokens[state.activeId] : undefined) ?? null;
