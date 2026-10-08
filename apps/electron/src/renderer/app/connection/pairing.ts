import { buildPairingLink, PAIRING_ACTION, parsePairingLink, type PairingAction } from "@tesseract/protocol";
import type { ConnectionConfig, ConnectionInput } from "../../../shared/contracts/connection";

export type PairingTarget = Pick<ConnectionConfig, "apiUrl" | "token" | "name" | "pairingUrl">;

export function pairingLinkFor(config: PairingTarget | null, action: PairingAction = PAIRING_ACTION): string | null {
  if (!config) return null;
  try {
    return buildPairingLink({ url: config.pairingUrl ?? config.apiUrl, token: config.token, name: config.name ?? undefined }, action);
  } catch {
    return null;
  }
}

export type PairingInputResult = { ok: true; value: ConnectionInput } | { ok: false; error: string };

export function inputFromPairingLink(link: string): PairingInputResult {
  const parsed = parsePairingLink(link);
  if (!parsed.ok) return { ok: false, error: parsed.error.message };
  const { url, token, name } = parsed.value;
  return { ok: true, value: { apiUrl: url, token, name: name ?? null, pairingUrl: url } };
}
