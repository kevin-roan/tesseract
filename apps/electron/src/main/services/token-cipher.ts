import { safeStorage } from "electron";
import type { ConfigData } from "../../core/config";
import { hasSealedToken, readStoredConnection, type TokenCipher } from "../../core/connection";
import type { ConnectionConfig } from "../../shared/contracts/connection";

export const tokenCipher: TokenCipher = {
  available: () => safeStorage.isEncryptionAvailable(),
  seal: (plain) => safeStorage.encryptString(plain).toString("base64"),
  unseal: (sealed) => safeStorage.decryptString(Buffer.from(sealed, "base64")),
};

export function storedConnection(data: ConfigData, env: Record<string, string | undefined> = process.env): ConnectionConfig | null {
  return readStoredConnection(data, env, hasSealedToken(data) ? tokenCipher : null);
}
