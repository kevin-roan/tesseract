import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { AccountState } from "../../../../shared/contracts/account";
import { errorMessage } from "../../../components/FormDialog";
import { ipc } from "../../../lib/ipc";
import { ACCOUNT_KEYS } from "../constants";
import { ACCOUNT_FORM_LABELS as L } from "../labels";
import { canSubmitSignIn } from "../model";

export interface SignInForm {
  email: string;
  password: string;
  displayName: string;
  server: string;
  busy: boolean;
  error: string | null;
  canSubmit: boolean;
  setEmail(value: string): void;
  setPassword(value: string): void;
  setDisplayName(value: string): void;
  setServer(value: string): void;
  saveServer(): Promise<void>;
  signIn(): Promise<void>;
  signUp(): Promise<void>;
}

/** Password sign-in and sign-up against the account service (shared by onboarding and Settings › Account). */
export function useSignIn(state: AccountState | null): SignInForm {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [server, setServer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serverValue = server ?? state?.serverUrl ?? "";

  const run = useCallback(
    async (task: () => Promise<AccountState>, failure: (message: string) => string) => {
      setBusy(true);
      setError(null);
      try {
        queryClient.setQueryData(ACCOUNT_KEYS.state, await task());
        setPassword("");
      } catch (caught) {
        setError(failure(errorMessage(caught)));
      } finally {
        setBusy(false);
      }
    },
    [queryClient],
  );

  const saveServer = useCallback(async () => {
    if (server === null || server.trim() === (state?.serverUrl ?? "")) return;
    await run(() => ipc.account.setServer(server), L.serverFailed);
    setServer(null);
  }, [run, server, state?.serverUrl]);

  const withServer = useCallback(
    async (task: () => Promise<AccountState>) => {
      if (server !== null && server.trim() !== (state?.serverUrl ?? "")) await ipc.account.setServer(server);
      setServer(null);
      return task();
    },
    [server, state?.serverUrl],
  );

  const signIn = useCallback(() => run(() => withServer(() => ipc.account.signIn(email.trim(), password)), L.failed), [email, password, run, withServer]);
  const signUp = useCallback(
    () => run(() => withServer(() => ipc.account.signUp(email.trim(), password, displayName.trim() || undefined)), L.signUpFailed),
    [displayName, email, password, run, withServer],
  );

  return {
    email,
    password,
    displayName,
    server: serverValue,
    busy,
    error,
    canSubmit: !busy && canSubmitSignIn({ email, password }, serverValue.trim() || null),
    setEmail,
    setPassword,
    setDisplayName,
    setServer,
    saveServer,
    signIn,
    signUp,
  };
}
