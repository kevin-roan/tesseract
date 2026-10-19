import { LIMITS } from "@tesseract/protocol";

export const SANDBOX_RENAME_HINT = "Only changes the name on this device. The sandbox keeps running as it is.";

export function sandboxRenameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a name.";
  return trimmed.length > LIMITS.maxPairingNameLength ? `Keep the name under ${LIMITS.maxPairingNameLength} characters.` : null;
}
