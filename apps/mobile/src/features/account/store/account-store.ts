import { create } from "zustand";
import type { Account, AccountSession } from "@tesseract/protocol";

import { sessionStorage } from "./session-storage";

type AccountStore = {
  session: AccountSession | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (session: AccountSession) => Promise<void>;
  updateAccount: (account: Account) => void;
  clear: () => Promise<void>;
};

let hydrating: Promise<void> | null = null;

export const useAccountStore = create<AccountStore>()((set, get) => ({
  session: null,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return Promise.resolve();
    hydrating ??= sessionStorage
      .read()
      .catch(() => null)
      .then((saved) => {
        set((state) => ({ hydrated: true, session: state.session ?? saved }));
      })
      .finally(() => {
        hydrating = null;
      });
    return hydrating;
  },

  setSession: async (session) => {
    set({ session, hydrated: true });
    await sessionStorage.write(session).catch(() => undefined);
  },

  updateAccount: (account) => {
    const { session } = get();
    if (!session || session.account.id !== account.id || JSON.stringify(session.account) === JSON.stringify(account)) return;
    const next = { ...session, account };
    set({ session: next });
    sessionStorage.write(next).catch(() => undefined);
  },

  clear: async () => {
    set({ session: null, hydrated: true });
    await sessionStorage.remove().catch(() => undefined);
  },
}));

export function currentToken(): string | null {
  return useAccountStore.getState().session?.token ?? null;
}
