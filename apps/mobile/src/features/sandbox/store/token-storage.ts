import * as SecureStore from "expo-secure-store";

import { tokenStorageKey } from "../utils/identity";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const tokenStorage = {
  read: (sandboxId: string): Promise<string | null> => SecureStore.getItemAsync(tokenStorageKey(sandboxId), OPTIONS),
  write: (sandboxId: string, token: string): Promise<void> =>
    SecureStore.setItemAsync(tokenStorageKey(sandboxId), token, OPTIONS),
  remove: (sandboxId: string): Promise<void> => SecureStore.deleteItemAsync(tokenStorageKey(sandboxId), OPTIONS),
};
