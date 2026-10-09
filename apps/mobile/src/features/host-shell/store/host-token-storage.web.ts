import { browserStorage } from "@/features/sandbox/store/browser-storage";

import { LEGACY_HOST_TOKEN_KEY } from "../utils/constants";
import { hostTokenKey } from "../utils/pairing";

export const hostTokenStorage = {
  read: async (sandboxId: string): Promise<string | null> => browserStorage().getItem(hostTokenKey(sandboxId)),
  write: async (sandboxId: string, token: string): Promise<void> => {
    browserStorage().setItem(hostTokenKey(sandboxId), token);
  },
  remove: async (sandboxId: string): Promise<void> => {
    browserStorage().removeItem(hostTokenKey(sandboxId));
  },
  readLegacy: async (): Promise<string | null> => browserStorage().getItem(LEGACY_HOST_TOKEN_KEY),
  removeLegacy: async (): Promise<void> => {
    browserStorage().removeItem(LEGACY_HOST_TOKEN_KEY);
  },
};
