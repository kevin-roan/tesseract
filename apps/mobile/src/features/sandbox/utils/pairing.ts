import {
  LIMITS,
  PAIRING_SCHEME,
  isValidToken,
  parseBaseUrl,
  parsePairingLink,
  type PairingPayload,
} from "@theone/protocol";

import type { PairingDraft, PairingErrors } from "../types";

export const EMPTY_PAIRING_DRAFT: PairingDraft = { url: "", token: "", name: "" };

export type ValidPairing = { baseUrl: string; token: string; name: string };

export type PairingValidation = { ok: true; value: ValidPairing } | { ok: false; errors: PairingErrors };

type SearchParam = string | string[] | undefined;

const first = (value: SearchParam): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

export function validatePairingDraft(draft: PairingDraft): PairingValidation {
  const errors: PairingErrors = {};
  const url = parseBaseUrl(draft.url);
  if (!url.ok) errors.url = url.error.code === "empty" ? "Enter the controller URL." : url.error.message;

  const token = draft.token.trim();
  if (!token) errors.token = "Enter the pairing token.";
  else if (!isValidToken(token)) errors.token = "The token contains characters that are not allowed.";

  const name = draft.name.trim();
  if (name.length > LIMITS.maxPairingNameLength) {
    errors.name = `Keep the name under ${LIMITS.maxPairingNameLength} characters.`;
  }

  if (!url.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { baseUrl: url.value, token, name } };
}

function draftFromPayload(payload: PairingPayload): PairingDraft {
  return { url: payload.url, token: payload.token, name: payload.name ?? "" };
}

export function draftFromSearchParams(params: { url?: SearchParam; token?: SearchParam; name?: SearchParam }): PairingDraft | null {
  const url = first(params.url).trim();
  const token = first(params.token).trim();
  if (!url && !token) return null;
  return { url, token, name: first(params.name).trim() };
}

const LINK_PREFIX = new RegExp(`^\\s*${PAIRING_SCHEME}:`, "i");

export function isPairingLink(text: string): boolean {
  return LINK_PREFIX.test(text);
}

export type LinkParseResult = { ok: true; draft: PairingDraft } | { ok: false; message: string };

export function parsePairingText(text: string): LinkParseResult {
  const parsed = parsePairingLink(text);
  if (parsed.ok) return { ok: true, draft: draftFromPayload(parsed.value) };
  if (parsed.error.code === "invalid_scheme") {
    return { ok: false, message: `That code is not a TheOne pairing link (${PAIRING_SCHEME}://pair).` };
  }
  return { ok: false, message: parsed.error.message };
}

export function fallbackSandboxName(draftName: string, sandboxId: string, hostname: string): string {
  return draftName.trim() || sandboxId.trim() || hostname.trim() || "Sandbox";
}
