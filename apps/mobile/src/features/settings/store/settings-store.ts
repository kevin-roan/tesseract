import type { SttProvider } from "@theone/protocol";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { IslandPlacement, OrbDock } from "@/features/island/types";
import { DEFAULT_ISLAND_DOCK, DEFAULT_ISLAND_PLACEMENT } from "@/features/island/utils/constants";
import { cornerDock, isIslandPlacement, isOrbDock } from "@/features/island/utils/placement";
import { listStorage } from "@/features/sandbox/store/list-storage";

import { DEFAULT_STT_PROVIDER, SETTINGS_STORE_NAME, SETTINGS_STORE_VERSION } from "../utils/constants";
import { isSttProvider } from "../utils/stt";

type SettingsPrefs = {
  sttProvider: SttProvider;
  islandPlacement: IslandPlacement;
  islandDock: OrbDock;
  liveActivity: boolean;
};

export type SettingsStore = SettingsPrefs & {
  setSttProvider: (sttProvider: SttProvider) => void;
  setIslandPlacement: (islandPlacement: IslandPlacement) => void;
  setIslandDock: (islandDock: OrbDock) => void;
  setLiveActivity: (liveActivity: boolean) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      sttProvider: DEFAULT_STT_PROVIDER,
      islandPlacement: DEFAULT_ISLAND_PLACEMENT,
      islandDock: DEFAULT_ISLAND_DOCK,
      liveActivity: true,
      setSttProvider: (sttProvider) => set({ sttProvider }),
      setIslandPlacement: (islandPlacement) =>
        set(islandPlacement === "hidden" ? { islandPlacement } : { islandPlacement, islandDock: cornerDock(islandPlacement) }),
      setIslandDock: (islandDock) => set({ islandDock }),
      setLiveActivity: (liveActivity) => set({ liveActivity }),
    }),
    {
      name: SETTINGS_STORE_NAME,
      version: SETTINGS_STORE_VERSION,
      storage: createJSONStorage(() => listStorage),
      partialize: ({ sttProvider, islandPlacement, islandDock, liveActivity }): SettingsPrefs => ({
        sttProvider,
        islandPlacement,
        islandDock,
        liveActivity,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SettingsPrefs>;
        return {
          ...current,
          ...(isSttProvider(saved.sttProvider) ? { sttProvider: saved.sttProvider } : {}),
          ...(isIslandPlacement(saved.islandPlacement) ? { islandPlacement: saved.islandPlacement } : {}),
          ...(isOrbDock(saved.islandDock) ? { islandDock: saved.islandDock } : {}),
          ...(typeof saved.liveActivity === "boolean" ? { liveActivity: saved.liveActivity } : {}),
        };
      },
    },
  ),
);
