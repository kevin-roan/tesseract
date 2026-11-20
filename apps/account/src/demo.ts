import { AccountEmailSchema, AccountPasswordSchema } from "@tesseract/protocol";
import { hashPassword } from "./app";
import type { Store } from "./store";

export type DemoResult = "skipped" | "created" | "updated" | "unchanged";

/** Creates the App Review demo account, or resets its password when the configured one changed. */
export async function seedDemoAccount(store: Store, email: string | null, password: string | null): Promise<DemoResult> {
  if (!email || !password) return "skipped";
  const normalized = AccountEmailSchema.parse(email);
  AccountPasswordSchema.parse(password);
  const existing = store.accountByEmail(normalized);
  if (!existing) {
    store.createAccount({
      email: normalized,
      displayName: "App Review",
      provider: "password",
      passwordHash: await hashPassword(password),
      appleSub: null,
    });
    return "created";
  }
  if (existing.password_hash && (await Bun.password.verify(password, existing.password_hash))) return "unchanged";
  store.setPasswordHash(existing.id, await hashPassword(password));
  return "updated";
}
