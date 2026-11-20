import { join } from "node:path";
import { app } from "electron";
import { ACCOUNT, AccountService, AccountStore } from "../../core/account";
import type { AccountState } from "../../shared/contracts/account";
import { broadcast } from "../ipc/_framework/events";
import { tokenCipher } from "./token-cipher";

type AccountListener = (next: AccountState, previous: AccountState) => void;

let service: AccountService | null = null;
let last: AccountState | null = null;
const listeners = new Set<AccountListener>();

/** The desktop's Tesseract account; its session token is sealed with `safeStorage` in userData. */
export function accountService(): AccountService {
  service ??= new AccountService({
    store: new AccountStore(join(app.getPath("userData"), ACCOUNT.sessionFile), tokenCipher),
    envUrl: process.env[ACCOUNT.urlEnv] ?? null,
    onChange: (state) => {
      const previous = last ?? state;
      last = state;
      broadcast("account", "state", state);
      for (const listener of listeners) listener(state, previous);
    },
  });
  return service;
}

export function onAccountChanged(listener: AccountListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
