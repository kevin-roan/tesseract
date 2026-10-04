import { browserStorage } from "@/features/sandbox/store/browser-storage";

import { HOST_TOKEN_KEY } from "../utils/constants";

export const hostTokenStorage = {
  read: async (): Promise<string | null> => browserStorage().getItem(HOST_TOKEN_KEY),
  write: async (token: string): Promise<void> => {
    browserStorage().setItem(HOST_TOKEN_KEY, token);
  },
  remove: async (): Promise<void> => {
    browserStorage().removeItem(HOST_TOKEN_KEY);
  },
};
