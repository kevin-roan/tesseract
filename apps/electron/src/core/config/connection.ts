import type { ConnectionConfig, ConnectionInput } from "../../shared/contracts/connection";
import type { ConfigData } from "./store";

export const CONNECTION_KEYS = ["url", "token", "name", "pairingUrl"] as const;
export const LEGACY_URL_KEY = "apiUrl";

export const CONNECTION_ENV = {
  url: "TESSERACT_DESKTOP_URL",
  token: "TESSERACT_TOKEN",
  name: "TESSERACT_DESKTOP_NAME",
  pairingUrl: "TESSERACT_DESKTOP_PAIRING_URL",
} as const;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function connectionFromJson(data: ConfigData, source: ConnectionConfig["source"]): ConnectionConfig | null {
  const apiUrl = text(data.url) ?? text(data[LEGACY_URL_KEY]);
  const token = text(data.token);
  if (!apiUrl || !token) return null;
  return { apiUrl, token, name: text(data.name), pairingUrl: text(data.pairingUrl), source };
}

export function connectionFromEnv(env: Record<string, string | undefined>): ConnectionConfig | null {
  return connectionFromJson(
    {
      url: env[CONNECTION_ENV.url],
      token: env[CONNECTION_ENV.token],
      name: env[CONNECTION_ENV.name],
      pairingUrl: env[CONNECTION_ENV.pairingUrl],
    },
    "env",
  );
}

export function initialConnection(data: ConfigData, env: Record<string, string | undefined>): ConnectionConfig | null {
  return connectionFromJson(data, "file") ?? connectionFromEnv(env);
}

export function withConnection(data: ConfigData, input: ConnectionInput | null): ConfigData {
  const next = { ...data };
  for (const key of [...CONNECTION_KEYS, LEGACY_URL_KEY]) delete next[key];
  if (!input) return next;
  next.url = input.apiUrl.trim();
  next.token = input.token.trim();
  if (input.name?.trim()) next.name = input.name.trim();
  if (input.pairingUrl?.trim()) next.pairingUrl = input.pairingUrl.trim();
  return next;
}
