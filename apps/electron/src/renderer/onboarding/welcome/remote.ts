import { PAIRING_SCHEME } from "@tesseract/protocol";
import { inputFromPairingLink } from "../../app/connection";
import type { ConnectionInput } from "../../../shared/contracts/connection";
import { REMOTE_LABELS } from "./labels";

export type RemoteField = "address" | "token";

export type RemoteInputResult = { ok: true; value: ConnectionInput } | { ok: false; errors: Partial<Record<RemoteField, string>> };

export function isPairingLink(address: string): boolean {
  return address.trim().toLowerCase().startsWith(`${PAIRING_SCHEME}:`);
}

export function remoteInput(address: string, token: string): RemoteInputResult {
  const trimmed = address.trim();
  if (!trimmed) return { ok: false, errors: { address: REMOTE_LABELS.addressMissing } };
  if (isPairingLink(trimmed)) {
    const parsed = inputFromPairingLink(trimmed);
    return parsed.ok ? parsed : { ok: false, errors: { address: REMOTE_LABELS.invalidLink(parsed.error) } };
  }
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return { ok: false, errors: { address: REMOTE_LABELS.invalidUrl } };
  if (!token.trim()) return { ok: false, errors: { token: REMOTE_LABELS.tokenMissing } };
  return { ok: true, value: { apiUrl: trimmed, token: token.trim(), name: null, pairingUrl: null } };
}
