import * as SecureStore from "expo-secure-store";
import type { AccountSession } from "@tesseract/protocol";

import { SESSION_STORAGE_KEY, parseStoredSession } from "../utils/session";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const sessionStorage = {
  read: async (): Promise<AccountSession | null> => parseStoredSession(await SecureStore.getItemAsync(SESSION_STORAGE_KEY, OPTIONS)),
  write: (session: AccountSession): Promise<void> => SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session), OPTIONS),
  remove: (): Promise<void> => SecureStore.deleteItemAsync(SESSION_STORAGE_KEY, OPTIONS),
};
