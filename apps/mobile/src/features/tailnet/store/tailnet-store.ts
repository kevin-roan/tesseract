import type { TailnetStatus } from "@tesseract/protocol";
import { create } from "zustand";

import type { TailnetConfig } from "./tailnet-config-storage";

export type TailnetStore = {
  status: TailnetStatus | null;
  config: TailnetConfig | null;
  setStatus: (status: TailnetStatus | null) => void;
  setConfig: (config: TailnetConfig | null) => void;
};

export const useTailnetStore = create<TailnetStore>((set) => ({
  status: null,
  config: null,
  setStatus: (status) => set({ status }),
  setConfig: (config) => set({ config }),
}));
