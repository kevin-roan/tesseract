import type { Account, AccountDevice } from "@tesseract/protocol";
import type { DefineContract } from "../ipc-types";

/** The desktop's Tesseract account (docs/adr/0014-embedded-tailnet-and-tesseract-accounts.md). */
export interface AccountState {
  /** Account service base URL: the saved one, else `TESSERACT_ACCOUNT_URL`; null when neither is set. */
  serverUrl: string | null;
  account: Account | null;
  expiresAt: string | null;
  /** False when the session can't be encrypted (no keychain): it then lasts until the app quits. */
  persisted: boolean;
  error: string | null;
}

export type AccountContract = DefineContract<{
  methods: {
    state(): AccountState;
    setServer(url: string): AccountState;
    signIn(email: string, password: string): AccountState;
    signUp(email: string, password: string, displayName?: string): AccountState;
    signOut(): AccountState;
    refresh(): AccountState;
    devices(): AccountDevice[];
    removeDevice(id: string): AccountDevice[];
    deleteAccount(): AccountState;
  };
  events: {
    state: AccountState;
  };
}>;
