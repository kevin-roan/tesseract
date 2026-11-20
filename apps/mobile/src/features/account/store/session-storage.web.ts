import type { AccountSession } from "@tesseract/protocol";

import { browserStorage } from "@/features/sandbox/store/browser-storage";

import { SESSION_STORAGE_KEY, parseStoredSession } from "../utils/session";

export const sessionStorage = {
  read: async (): Promise<AccountSession | null> => parseStoredSession(browserStorage().getItem(SESSION_STORAGE_KEY)),
  write: async (session: AccountSession): Promise<void> => {
    browserStorage().setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  },
  remove: async (): Promise<void> => {
    browserStorage().removeItem(SESSION_STORAGE_KEY);
  },
};
