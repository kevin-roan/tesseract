import { INPUT_MODES, type InputMode } from "@tesseract/protocol";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_INPUT_MODE, DISPLAY_STORE_NAME, DISPLAY_STORE_VERSION } from "../utils/constants";
import { listStorage } from "./list-storage";

type DisplayPrefs = { inputMode: InputMode };

export type DisplayStore = DisplayPrefs & {
  setInputMode: (inputMode: InputMode) => void;
};

const isInputMode = (value: unknown): value is InputMode => (INPUT_MODES as readonly unknown[]).includes(value);

export const useDisplayStore = create<DisplayStore>()(
  persist(
    (set) => ({
      inputMode: DEFAULT_INPUT_MODE,
      setInputMode: (inputMode) => set({ inputMode }),
    }),
    {
      name: DISPLAY_STORE_NAME,
      version: DISPLAY_STORE_VERSION,
      storage: createJSONStorage(() => listStorage),
      partialize: ({ inputMode }): DisplayPrefs => ({ inputMode }),
      merge: (persisted, current) => {
        const inputMode = (persisted as Partial<DisplayPrefs> | undefined)?.inputMode;
        return isInputMode(inputMode) ? { ...current, inputMode } : current;
      },
    },
  ),
);
