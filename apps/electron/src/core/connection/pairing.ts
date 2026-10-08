import { buildPairingLink, normalizeBaseUrl, parsePairingLink } from "@tesseract/protocol";
import type { ConnectionConfig, ConnectionInput } from "../../shared/contracts/connection";

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
