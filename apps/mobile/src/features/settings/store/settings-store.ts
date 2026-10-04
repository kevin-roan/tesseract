import type { SttProvider } from "@theone/protocol";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { listStorage } from "@/features/sandbox/store/list-storage";

import { DEFAULT_STT_PROVIDER, SETTINGS_STORE_NAME, SETTINGS_STORE_VERSION } from "../utils/constants";
import { isSttProvider } from "../utils/stt";

type SettingsPrefs = { sttProvider: SttProvider };

export type SettingsStore = SettingsPrefs & {
  setSttProvider: (sttProvider: SttProvider) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      sttProvider: DEFAULT_STT_PROVIDER,
      setSttProvider: (sttProvider) => set({ sttProvider }),
    }),
    {
      name: SETTINGS_STORE_NAME,
      version: SETTINGS_STORE_VERSION,
      storage: createJSONStorage(() => listStorage),
      partialize: ({ sttProvider }): SettingsPrefs => ({ sttProvider }),
      merge: (persisted, current) => {
        const sttProvider = (persisted as Partial<SettingsPrefs> | undefined)?.sttProvider;
        return isSttProvider(sttProvider) ? { ...current, sttProvider } : current;
      },
    },
  ),
);
