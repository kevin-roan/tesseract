import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClaudeAccountList } from "@tesseract/protocol";
import { useCallback, useState } from "react";
import { describeError } from "../../../app/connection";
import { useWorkspaceActions } from "../../../features/projects/hooks/use-workspace";
import { sandboxErrorMessage } from "../shared/format";
import { usePreferencesToast } from "../shared/use-preferences-toast";
import { useSandboxLink } from "../shared/use-sandbox-link";
import { CLAUDE_KEYS } from "./constants";
import { CLAUDE_TOASTS, SECTION_LABELS } from "./labels";
import { hasTokenAccount } from "./model";

export function useClaudeSandbox() {
  const link = useSandboxLink();
  const queryClient = useQueryClient();
  const workspace = useWorkspaceActions();
  const toast = usePreferencesToast();
  const { client, online, baseUrl } = link;

  const auth = useQuery({
    queryKey: CLAUDE_KEYS.auth(baseUrl),
    queryFn: ({ signal }) => client!.claudeAuth({ signal }),
    enabled: online,
    retry: false,
    staleTime: 0,
  });
  const accounts = useQuery({
    queryKey: CLAUDE_KEYS.accounts(baseUrl),
    queryFn: ({ signal }) => client!.claudeAccounts({ signal }),
    enabled: online,
    retry: false,
    staleTime: 0,
  });

  const setDefault = useMutation({
    mutationFn: (accountId: string) => client!.setDefaultClaudeAccount({ accountId }),
    onSuccess: (list: ClaudeAccountList, accountId) => {
      queryClient.setQueryData(CLAUDE_KEYS.accounts(baseUrl), list);
      toast(CLAUDE_TOASTS.defaultChanged(accountId));
      void auth.refetch();
      void accounts.refetch();
      workspace.refresh();
    },
    onError: (error) => toast(CLAUDE_TOASTS.defaultFailed(describeError(error)), true),
  });

  const [tokenInput, setTokenInput] = useState("");
  const saveToken = useMutation({
    mutationFn: (token: string | null) => (token === null ? client!.clearClaudeToken() : client!.setClaudeToken({ token })),
    onSuccess: (list: ClaudeAccountList, token) => {
      queryClient.setQueryData(CLAUDE_KEYS.accounts(baseUrl), list);
      setTokenInput("");
      toast(token === null ? CLAUDE_TOASTS.tokenCleared : CLAUDE_TOASTS.tokenSaved);
      void auth.refetch();
      workspace.refresh();
    },
    onError: (error, token) => toast((token === null ? CLAUDE_TOASTS.tokenClearFailed : CLAUDE_TOASTS.tokenFailed)(describeError(error)), true),
  });
  const trimmedToken = tokenInput.trim();
  const { mutate: mutateToken } = saveToken;
  const submitToken = useCallback(() => {
    if (trimmedToken) mutateToken(trimmedToken);
  }, [mutateToken, trimmedToken]);
  const clearToken = useCallback(() => mutateToken(null), [mutateToken]);

  const refresh = useCallback(() => {
    if (!online) return;
    void auth.refetch();
    void accounts.refetch();
  }, [online, auth, accounts]);

  const authMessage = !online
    ? link.offline
    : auth.error
      ? sandboxErrorMessage(auth.error, SECTION_LABELS.outdated)
      : null;
  const accountsMessage = !online
    ? link.offline
    : accounts.error
      ? sandboxErrorMessage(accounts.error, SECTION_LABELS.accountsOutdated)
      : accounts.data && accounts.data.accounts.length === 0
        ? SECTION_LABELS.accountsEmpty
        : null;

  return {
    online,
    auth: online && !auth.error ? (auth.data ?? null) : null,
    authMessage,
    accounts: online && !accounts.error ? (accounts.data ?? null) : null,
    accountsMessage,
    pendingAccount: setDefault.isPending ? setDefault.variables : null,
    selectDefault: (id: string) => setDefault.mutate(id),
    token: {
      configured: hasTokenAccount(online && !accounts.error ? accounts.data : undefined),
      value: tokenInput,
      setValue: setTokenInput,
      canSave: online && trimmedToken.length > 0 && !saveToken.isPending,
      saving: saveToken.isPending && saveToken.variables !== null,
      clearing: saveToken.isPending && saveToken.variables === null,
      submit: submitToken,
      clear: clearToken,
    },
    refresh,
  };
}
