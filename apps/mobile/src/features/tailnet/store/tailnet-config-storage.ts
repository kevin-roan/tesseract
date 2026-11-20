import * as SecureStore from "expo-secure-store";

import { TAILNET_CONFIG_KEY } from "../utils/constants";

export type TailnetConfig = {
  loginServer: string;
  hostname: string;
  magicDnsSuffix: string | null;
};

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function parseConfig(raw: string | null): TailnetConfig | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TailnetConfig>;
    if (typeof value.loginServer !== "string" || typeof value.hostname !== "string") return null;
    return { loginServer: value.loginServer, hostname: value.hostname, magicDnsSuffix: value.magicDnsSuffix ?? null };
  } catch {
    return null;
  }
}

export const tailnetConfigStorage = {
  read: async (): Promise<TailnetConfig | null> => parseConfig(await SecureStore.getItemAsync(TAILNET_CONFIG_KEY, OPTIONS)),
  write: (config: TailnetConfig): Promise<void> => SecureStore.setItemAsync(TAILNET_CONFIG_KEY, JSON.stringify(config), OPTIONS),
  remove: (): Promise<void> => SecureStore.deleteItemAsync(TAILNET_CONFIG_KEY, OPTIONS),
};
