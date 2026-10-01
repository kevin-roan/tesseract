import { useMemo } from "react";
import type { ClaudeSession } from "@theone/protocol";
import { router } from "expo-router";

import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";

import { sessionTarget } from "../utils/activity";

export function useAnalyticsNavigation() {
  const sandbox = useSandboxNavigation();
  return useMemo(
    () => ({
      back: () => (router.canGoBack() ? router.back() : router.replace("/")),
      project: (id: string, days: number) =>
        router.push({ pathname: "/analytics/projects/[id]", params: { id, days: String(days) } }),
      newAgentRun: () => sandbox.newAgentRun(),
      sessionPress: (session: ClaudeSession) => {
        const target = sessionTarget(session);
        if (!target) return undefined;
        return target.kind === "agent" ? () => sandbox.agentRun(target.id) : () => sandbox.terminal(target.id);
      },
    }),
    [sandbox],
  );
}
