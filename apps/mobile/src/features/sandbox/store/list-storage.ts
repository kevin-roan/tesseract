import { Storage } from "expo-sqlite/kv-store";
import type { StateStorage } from "zustand/middleware";

export const listStorage: StateStorage<Promise<void>> = {
  getItem: (name) => Storage.getItem(name),
  setItem: (name, value) => Storage.setItem(name, value),
  removeItem: (name) => Storage.removeItem(name),
};
