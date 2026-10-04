import * as SecureStore from "expo-secure-store";

import { HOST_TOKEN_KEY } from "../utils/constants";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const hostTokenStorage = {
  read: (): Promise<string | null> => SecureStore.getItemAsync(HOST_TOKEN_KEY, OPTIONS),
  write: (token: string): Promise<void> => SecureStore.setItemAsync(HOST_TOKEN_KEY, token, OPTIONS),
  remove: (): Promise<void> => SecureStore.deleteItemAsync(HOST_TOKEN_KEY, OPTIONS),
};
