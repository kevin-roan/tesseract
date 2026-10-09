import type { ConfigData } from "../config";
import type { TokenCipher } from "../connection/token-vault";

export interface SecretKeys {
  plain: string;
  sealed: string;
  env: string;
}

export function readSecret(data: ConfigData, keys: SecretKeys, env: Record<string, string | undefined>, cipher: TokenCipher | null): string | null {
  const fromEnv = env[keys.env]?.trim();
  if (fromEnv) return fromEnv;
  const plain = data[keys.plain];
  if (typeof plain === "string" && plain) return plain;
  const sealed = data[keys.sealed];
  if (typeof sealed !== "string" || !sealed || !cipher) return null;
  try {
    return cipher.available() ? cipher.unseal(sealed) || null : null;
  } catch {
    return null;
  }
}

export function storeSecret(data: ConfigData, keys: SecretKeys, value: string | null, sealWith: TokenCipher | null): ConfigData {
  const next = { ...data };
  delete next[keys.plain];
  delete next[keys.sealed];
  if (!value) return next;
  if (sealWith) next[keys.sealed] = sealWith.seal(value);
  else next[keys.plain] = value;
  return next;
}
