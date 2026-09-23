import { tokenStorageKey } from "../utils/identity";
import { browserStorage } from "./browser-storage";

export const tokenStorage = {
  read: async (sandboxId: string): Promise<string | null> => browserStorage().getItem(tokenStorageKey(sandboxId)),
  write: async (sandboxId: string, token: string): Promise<void> => {
    browserStorage().setItem(tokenStorageKey(sandboxId), token);
  },
  remove: async (sandboxId: string): Promise<void> => {
    browserStorage().removeItem(tokenStorageKey(sandboxId));
  },
};
