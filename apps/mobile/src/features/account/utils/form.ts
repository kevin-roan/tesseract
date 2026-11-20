import {
  AccountDisplayNameSchema,
  AccountEmailSchema,
  AccountPasswordSchema,
  type CreateAccount,
  type PasswordSignIn,
} from "@tesseract/protocol";

import { ACCOUNT_ERRORS } from "./content";

export type AuthMode = "signIn" | "signUp";

export const OTHER_AUTH_MODE: Record<AuthMode, AuthMode> = { signIn: "signUp", signUp: "signIn" };

export type AuthField = "email" | "password" | "displayName";

export type AuthDraft = Record<AuthField, string>;

export type AuthErrors = Partial<Record<AuthField, string>>;

export const EMPTY_AUTH_DRAFT: AuthDraft = { email: "", password: "", displayName: "" };

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: AuthErrors };

export function validateSignIn(draft: AuthDraft): Validation<PasswordSignIn> {
  const email = AccountEmailSchema.safeParse(draft.email);
  const errors: AuthErrors = {};
  if (!email.success) errors.email = ACCOUNT_ERRORS.email;
  if (!draft.password) errors.password = ACCOUNT_ERRORS.passwordRequired;
  if (!email.success || errors.password) return { ok: false, errors };
  return { ok: true, value: { email: email.data, password: draft.password } };
}

export function validateSignUp(draft: AuthDraft): Validation<CreateAccount> {
  const email = AccountEmailSchema.safeParse(draft.email);
  const password = AccountPasswordSchema.safeParse(draft.password);
  const name = draft.displayName.trim() ? AccountDisplayNameSchema.safeParse(draft.displayName) : null;
  const errors: AuthErrors = {};
  if (!email.success) errors.email = ACCOUNT_ERRORS.email;
  if (!password.success) errors.password = ACCOUNT_ERRORS.password;
  if (name && !name.success) errors.displayName = ACCOUNT_ERRORS.displayName;
  if (!email.success || !password.success || (name && !name.success)) return { ok: false, errors };
  return {
    ok: true,
    value: { email: email.data, password: password.data, ...(name?.success ? { displayName: name.data } : {}) },
  };
}

export function appleDisplayName(parts: { givenName?: string | null; familyName?: string | null } | null): string | undefined {
  const name = [parts?.givenName, parts?.familyName].filter(Boolean).join(" ").trim();
  const parsed = AccountDisplayNameSchema.safeParse(name);
  return parsed.success ? parsed.data : undefined;
}
