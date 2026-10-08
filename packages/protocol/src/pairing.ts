import { HOST_PAIRING_ACTION, LIMITS, PAIRING_ACTION, PAIRING_SCHEME } from "./constants";
import { buildQuery, parseBaseUrl, parseParams, type ParseResult } from "./url";

export type PairingPayload = { url: string; token: string; name?: string };

export type PairingErrorCode =
  | "empty"
  | "invalid_scheme"
  | "invalid_action"
  | "missing_url"
  | "invalid_url"
  | "missing_token"
  | "invalid_token";

export type PairingParseResult = ParseResult<PairingPayload, PairingErrorCode>;

export const TOKEN_PATTERN = /^[\x21-\x7e]{1,1024}$/;

export type PairingAction = typeof PAIRING_ACTION | typeof HOST_PAIRING_ACTION;

const linkPattern = (action: PairingAction) => new RegExp(`^${PAIRING_SCHEME}:\\/\\/\\/?${action}\\/?(?:\\?([^#]*))?(?:#.*)?$`, "i");
const SCHEME_PATTERN = new RegExp(`^${PAIRING_SCHEME}:`, "i");

function fail(code: PairingErrorCode, message: string): PairingParseResult {
  return { ok: false, error: { code, message } };
}

function normalizeName(name: string | undefined): string | undefined {
  const trimmed = name?.trim().slice(0, LIMITS.maxPairingNameLength).trim();
  return trimmed ? trimmed : undefined;
}

export function isValidToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/**
 * Builds `tesseract://pair?url=…&token=…&name=…` (or `tesseract://host?…` for the host shell).
 * Throws TypeError when the url or token is unusable.
 */
export function buildPairingLink(payload: PairingPayload, action: PairingAction = PAIRING_ACTION): string {
  const url = parseBaseUrl(payload.url);
  if (!url.ok) throw new TypeError(`Invalid pairing url: ${url.error.message}`);
  if (!isValidToken(payload.token)) throw new TypeError("Invalid pairing token");
  const query = buildQuery({ url: url.value, token: payload.token, name: normalizeName(payload.name) });
  return `${PAIRING_SCHEME}://${action}${query}`;
}

/** Parses a `tesseract://pair?…` (or `tesseract://host?…`) link. Whitespace anywhere in the input (QR/paste line breaks) is ignored. */
export function parsePairingLink(input: string, action: PairingAction = PAIRING_ACTION): PairingParseResult {
  const compact = input.replace(/\s+/g, "");
  if (!compact) return fail("empty", "Pairing link is empty");
  if (!SCHEME_PATTERN.test(compact)) {
    return fail("invalid_scheme", `Pairing link must start with ${PAIRING_SCHEME}://`);
  }
  const match = linkPattern(action).exec(compact);
  if (!match) return fail("invalid_action", `Pairing link must be ${PAIRING_SCHEME}://${action}?…`);
  const params = parseParams(match[1] ?? "");
  if (!params.url) return fail("missing_url", "Pairing link has no url");
  const url = parseBaseUrl(params.url);
  if (!url.ok) return fail("invalid_url", url.error.message);
  if (!params.token) return fail("missing_token", "Pairing link has no token");
  if (!isValidToken(params.token)) return fail("invalid_token", "Pairing token is invalid");
  const name = normalizeName(params.name);
  return { ok: true, value: name ? { url: url.value, token: params.token, name } : { url: url.value, token: params.token } };
}
