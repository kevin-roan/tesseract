import { buildPairingLink, normalizeBaseUrl, parsePairingLink } from "@tesseract/protocol";
import type { ConnectionConfig, ConnectionInput } from "../../shared/contracts/connection";
import { PAIRING_LINK_SCHEME } from "./constants";
import { CONNECTION_MESSAGES } from "./labels";

export type PairingTarget = Pick<ConnectionConfig, "apiUrl" | "token" | "name" | "pairingUrl">;

export type InputResult = { ok: true; value: ConnectionInput } | { ok: false; error: string };

export function pairingLinkFor(config: PairingTarget): string {
  return buildPairingLink({ url: config.pairingUrl ?? config.apiUrl, token: config.token, name: config.name ?? undefined });
}

export function inputFromPairingLink(link: string): InputResult {
  const parsed = parsePairingLink(link);
  if (!parsed.ok) return { ok: false, error: parsed.error.message };
  const { url, token, name } = parsed.value;
  return { ok: true, value: { apiUrl: url, token, name: name ?? null, pairingUrl: url } };
}

export function normalizeConnectionInput(input: ConnectionInput): ConnectionInput | null {
  const apiUrl = normalizeBaseUrl(input.apiUrl ?? "");
  const token = (input.token ?? "").trim();
  if (!apiUrl || !token) return null;
  const name = input.name?.trim() || null;
  const pairingUrl = input.pairingUrl?.trim() ? normalizeBaseUrl(input.pairingUrl) : null;
  return { apiUrl, token, name, pairingUrl };
}

export function resolveConnectionInput(input: ConnectionInput): InputResult {
  if (typeof input !== "object" || input === null) return { ok: false, error: CONNECTION_MESSAGES.invalidInput };
  const raw = typeof input?.apiUrl === "string" ? input.apiUrl.trim() : "";
  if (raw.toLowerCase().startsWith(PAIRING_LINK_SCHEME)) {
    const parsed = inputFromPairingLink(raw);
    if (!parsed.ok) return { ok: false, error: CONNECTION_MESSAGES.invalidLink(parsed.error) };
    const name = input.name?.trim() || parsed.value.name;
    const value = normalizeConnectionInput({ ...parsed.value, name });
    return value ? { ok: true, value } : { ok: false, error: CONNECTION_MESSAGES.invalidInput };
  }
  const value = normalizeConnectionInput(input);
  return value ? { ok: true, value } : { ok: false, error: CONNECTION_MESSAGES.invalidInput };
}
