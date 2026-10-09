import * as SecureStore from "expo-secure-store";

import { LEGACY_HOST_TOKEN_KEY } from "../utils/constants";
import { hostTokenKey } from "../utils/pairing";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const hostTokenStorage = {
  read: (sandboxId: string): Promise<string | null> => SecureStore.getItemAsync(hostTokenKey(sandboxId), OPTIONS),
  write: (sandboxId: string, token: string): Promise<void> => SecureStore.setItemAsync(hostTokenKey(sandboxId), token, OPTIONS),
  remove: (sandboxId: string): Promise<void> => SecureStore.deleteItemAsync(hostTokenKey(sandboxId), OPTIONS),
  readLegacy: (): Promise<string | null> => SecureStore.getItemAsync(LEGACY_HOST_TOKEN_KEY, OPTIONS),
  removeLegacy: (): Promise<void> => SecureStore.deleteItemAsync(LEGACY_HOST_TOKEN_KEY, OPTIONS),
};
