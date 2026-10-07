import type { ConnectionConfig, ConnectionInput } from "../../shared/contracts/connection";
import { ENV } from "../../shared/runtime";
import { connectionFromEnv, connectionFromJson, withConnection, type ConfigData } from "../config";
import { SEALED_TOKEN_KEY, TOKEN_KEY } from "./constants";

type Env = Record<string, string | undefined>;

export interface TokenCipher {
  available(): boolean;
  seal(plain: string): string;
  unseal(sealed: string): string;
}

export interface SealPolicy {
  platform: NodeJS.Platform;
  env: Env;
  configFile: string;
  defaultConfigFile: string;
  test: boolean;
  cipher: TokenCipher | null;
}

export function shouldSealTokens(policy: SealPolicy): boolean {
  if (policy.test || policy.platform === "linux" || !policy.cipher) return false;
  if (policy.env[ENV.config] || policy.env.XDG_CONFIG_HOME) return false;
  if (policy.configFile !== policy.defaultConfigFile) return false;
  try {
    return policy.cipher.available();
  } catch {
    return false;
  }
}

function unsealedToken(data: ConfigData, cipher: TokenCipher | null): string | null {
  const sealed = data[SEALED_TOKEN_KEY];
  if (typeof sealed !== "string" || !sealed || !cipher) return null;
  try {
    return cipher.available() ? cipher.unseal(sealed).trim() || null : null;
  } catch {
    return null;
  }
}

export function hasSealedToken(data: ConfigData): boolean {
  return typeof data[SEALED_TOKEN_KEY] === "string" && Boolean(data[SEALED_TOKEN_KEY]);
}

export function fileConnection(data: ConfigData, cipher: TokenCipher | null): ConnectionConfig | null {
  const plain = connectionFromJson(data, "file");
  if (plain) return plain;
  const token = unsealedToken(data, cipher);
  return token ? connectionFromJson({ ...data, [TOKEN_KEY]: token }, "file") : null;
}

export function readStoredConnection(data: ConfigData, env: Env, cipher: TokenCipher | null): ConnectionConfig | null {
  return fileConnection(data, cipher) ?? connectionFromEnv(env);
}

export function storeConnection(data: ConfigData, input: ConnectionInput | null, sealWith: TokenCipher | null): ConfigData {
  const next = withConnection(data, input);
  delete next[SEALED_TOKEN_KEY];
  const token = next[TOKEN_KEY];
  if (input && sealWith && typeof token === "string") {
    next[SEALED_TOKEN_KEY] = sealWith.seal(token);
    delete next[TOKEN_KEY];
  }
  return next;
}

export function sealPlainToken(data: ConfigData, cipher: TokenCipher): ConfigData | null {
  const plain = connectionFromJson(data, "file");
  if (!plain) return null;
  return storeConnection(
    data,
    { apiUrl: plain.apiUrl, token: plain.token, name: plain.name, pairingUrl: plain.pairingUrl },
    cipher,
  );
}
