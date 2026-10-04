import { useCallback, useMemo } from "react";

import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useSandboxRefresh } from "@/features/sandbox/hooks/use-sandbox-refresh";
import { describeError } from "@/features/sandbox/utils/errors";

import { claudeAccountRows, isClaudeAccountsUnsupported } from "../utils/accounts";
import { claudeStatusView } from "../utils/status";
import { useClaudeAccounts, useSetDefaultClaudeAccount } from "./use-claude-accounts";
import { useClaudeAuth } from "./use-claude-auth";

export function useClaudeAccountScreen() {
  const nav = useSandboxNavigation();
  const auth = useClaudeAuth();
  const accounts = useClaudeAccounts();
  const setDefault = useSetDefaultClaudeAccount();
  const { refreshing, refresh } = useSandboxRefresh();

  const status = auth.data;
  const view = useMemo(() => (status ? claudeStatusView(status) : null), [status]);

  const list = accounts.data;
  const pendingId = setDefault.isPending ? (setDefault.variables?.accountId ?? null) : null;
  const rows = useMemo(() => (list ? claudeAccountRows(list, pendingId) : null), [list, pendingId]);
  const unsupported = isClaudeAccountsUnsupported(accounts.error);

  const selectDefault = useCallback(
    (accountId: string) => {
      if (setDefault.isPending || accountId === list?.defaultAccountId) return;
      setDefault.mutate({ accountId });
    },
    [list, setDefault],
  );

  return {
    back: nav.back,
    view,
    error: auth.error ? describeError(auth.error) : null,
    retry: () => void auth.refetch(),
    accounts: rows,
    accountsLoading: accounts.isLoading,
    accountsError: accounts.error && !unsupported ? describeError(accounts.error) : null,
    accountsUnsupported: unsupported,
    retryAccounts: () => void accounts.refetch(),
    selectDefault,
    defaultError: setDefault.error ? describeError(setDefault.error) : null,
    refreshing,
    refresh,
  };
}
