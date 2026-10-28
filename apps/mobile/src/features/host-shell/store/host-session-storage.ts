import * as SecureStore from "expo-secure-store";

import type { HostSessionState } from "../types";
import { hostSessionKey } from "../utils/pairing";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function parse(value: string | null): HostSessionState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<HostSessionState>;
    return typeof parsed.session === "string" && typeof parsed.expiresAt === "string" ? { session: parsed.session, expiresAt: parsed.expiresAt } : null;
  } catch {
    return null;
  }
}

/** The unlocked host session per sandbox, so it outlives an app restart until it expires (`LIMITS.hostSessionTtlMs`). */
export const hostSessionStorage = {
  read: async (sandboxId: string): Promise<HostSessionState | null> => parse(await SecureStore.getItemAsync(hostSessionKey(sandboxId), OPTIONS)),
  write: (sandboxId: string, session: HostSessionState): Promise<void> => SecureStore.setItemAsync(hostSessionKey(sandboxId), JSON.stringify(session), OPTIONS),
  remove: (sandboxId: string): Promise<void> => SecureStore.deleteItemAsync(hostSessionKey(sandboxId), OPTIONS),
};
