import { useCallback, useMemo, useState } from "react";
import type { Project } from "@theone/protocol";

import { describeError } from "@/features/sandbox/utils/errors";

import {
  accountIdForChoice,
  findClaudeAccount,
  isClaudeAccountsUnsupported,
  projectAccountChoice,
  projectAccountOptions,
  projectAccountSummary,
} from "../utils/accounts";
import { useClaudeAccounts, useSetProjectClaudeAccount } from "./use-claude-accounts";

export function useProjectClaudeAccount(project: Project | undefined) {
  const accounts = useClaudeAccounts();
  const setAccount = useSetProjectClaudeAccount();
  const [sheetOpen, setSheetOpen] = useState(false);
  const list = accounts.data;

  const pending = setAccount.isPending ? setAccount.variables : undefined;
  const accountId = pending ? pending.accountId : (project?.claudeAccountId ?? null);
  const options = useMemo(() => (list ? projectAccountOptions(list) : []), [list]);

  const open = useCallback(() => {
    setAccount.reset();
    setSheetOpen(true);
  }, [setAccount]);
  const close = useCallback(() => setSheetOpen(false), []);

  const select = useCallback(
    (choice: string) => {
      setSheetOpen(false);
      const next = accountIdForChoice(choice);
      if (!project || !list || next === accountId) return;
      if (next !== null && !findClaudeAccount(list, next)?.present) return;
      setAccount.mutate({ projectId: project.id, accountId: next });
    },
    [project, list, accountId, setAccount],
  );

  return {
    visible: Boolean(project) && !isClaudeAccountsUnsupported(accounts.error),
    summary: projectAccountSummary(accountId, list),
    canChoose: list !== undefined,
    saving: setAccount.isPending,
    error: setAccount.error ? describeError(setAccount.error) : null,
    sheetOpen,
    open,
    close,
    options,
    selectedId: projectAccountChoice(accountId),
    select,
  };
}

export type ProjectClaudeAccountState = ReturnType<typeof useProjectClaudeAccount>;
