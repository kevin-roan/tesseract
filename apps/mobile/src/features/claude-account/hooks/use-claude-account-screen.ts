import { useMemo } from "react";

import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useSandboxRefresh } from "@/features/sandbox/hooks/use-sandbox-refresh";
import { describeError } from "@/features/sandbox/utils/errors";

import { claudeStatusView } from "../utils/status";
import { useClaudeAuth } from "./use-claude-auth";

export function useClaudeAccountScreen() {
  const nav = useSandboxNavigation();
  const auth = useClaudeAuth();
  const { refreshing, refresh } = useSandboxRefresh();

  const status = auth.data;
  const view = useMemo(() => (status ? claudeStatusView(status) : null), [status]);

  return {
    back: nav.back,
    view,
    error: auth.error ? describeError(auth.error) : null,
    retry: () => void auth.refetch(),
    refreshing,
    refresh,
  };
}
