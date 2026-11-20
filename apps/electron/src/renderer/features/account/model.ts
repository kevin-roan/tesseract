import type { Account } from "@tesseract/protocol";

export function accountName(account: Pick<Account, "email" | "displayName" | "id">): string {
  return account.displayName || account.email || account.id;
}

export interface SignInDraft {
  email: string;
  password: string;
}

export function canSubmitSignIn(draft: SignInDraft, serverUrl: string | null): boolean {
  return Boolean(serverUrl && draft.email.trim() && draft.password);
}
