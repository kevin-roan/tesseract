import { GEMINI_FALLBACK_PREFIX } from "./constants";

export const fallbackNotice = (reason: string | null): string | null =>
  reason ? `${GEMINI_FALLBACK_PREFIX}: ${reason}` : null;
