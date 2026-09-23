import type { StateStorage } from "zustand/middleware";

import { browserStorage } from "./browser-storage";

export const listStorage: StateStorage = {
  getItem: (name) => browserStorage().getItem(name),
  setItem: (name, value) => browserStorage().setItem(name, value),
  removeItem: (name) => browserStorage().removeItem(name),
};
