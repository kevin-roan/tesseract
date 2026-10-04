import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { describeError } from "@/features/sandbox/utils/errors";

import { CLAUDE_ACCOUNTS_COPY, claudeAccountsSummary } from "../utils/accounts";
import { claudeAccountSummary } from "../utils/status";
import { useClaudeAccounts } from "./use-claude-accounts";
import { useClaudeAuth } from "./use-claude-auth";

export function useClaudeAccountEntry() {
  const nav = useSandboxNavigation();
  const claude = useClaudeAuth();
  const accounts = useClaudeAccounts();
  return {
    title: CLAUDE_ACCOUNTS_COPY.profileTitle,
    subtitle: accounts.data
      ? claudeAccountsSummary(accounts.data)
      : claude.error
        ? describeError(claude.error)
        : claudeAccountSummary(claude.data),
    open: nav.claudeAccount,
  };
}
