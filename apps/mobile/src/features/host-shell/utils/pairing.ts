import { HOST_PAIRING_ACTION, PAIRING_SCHEME, parsePairingLink } from "@tesseract/protocol";

import type { LinkParseResult } from "@/features/sandbox/utils/pairing";

import { HOST_FALLBACK_NAME, HOST_TOKEN_KEY_PREFIX, HOST_TOKEN_KEY_SUFFIX } from "./constants";

export function parseHostPairingText(text: string): LinkParseResult {
  const parsed = parsePairingLink(text, HOST_PAIRING_ACTION);
  if (parsed.ok) {
    const { url, token, name } = parsed.value;
    return { ok: true, draft: { url, token, name: name ?? "" } };
  }
  if (parsed.error.code === "invalid_scheme" || parsed.error.code === "invalid_action") {
    return { ok: false, message: `That code is not a host shell link (${PAIRING_SCHEME}://${HOST_PAIRING_ACTION}). Run \`bun run host pair\` on the host.` };
  }
  return { ok: false, message: parsed.error.message };
}

export function hostName(draftName: string, hostId: string): string {
  return draftName.trim() || hostId.trim() || HOST_FALLBACK_NAME;
}

export function hostTokenKey(sandboxId: string): string {
  return `${HOST_TOKEN_KEY_PREFIX}${sandboxId.replace(/[^A-Za-z0-9._-]/g, "_")}${HOST_TOKEN_KEY_SUFFIX}`;
}
