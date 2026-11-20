import { AccountSessionSchema, type AccountSession } from "@tesseract/protocol";

export const SESSION_STORAGE_KEY = "tesseract.account.session";

export function parseStoredSession(value: string | null, now: number = Date.now()): AccountSession | null {
  if (!value) return null;
  try {
    const parsed = AccountSessionSchema.safeParse(JSON.parse(value));
    if (!parsed.success) return null;
    return Date.parse(parsed.data.expiresAt) > now ? parsed.data : null;
  } catch {
    return null;
  }
}
