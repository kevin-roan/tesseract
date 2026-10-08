import { useCallback } from "react";
import { router } from "expo-router";
import type { ClaudeSession } from "@tesseract/protocol";

import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";

import { sessionTarget } from "../utils/sessions";

export function useChatNavigation() {
  const nav = useSandboxNavigation();

  const resume = useCallback((sessionId: string) => router.push({ pathname: "/chats/[id]", params: { id: sessionId } }), []);

  const open = useCallback(
    (session: Pick<ClaudeSession, "sessionId" | "agentRunId" | "terminalId">) => {
      const target = sessionTarget(session);
      if (target.kind === "agentRun") nav.agentRun(target.id);
      else if (target.kind === "terminal") nav.terminal(target.id);
      else resume(target.id);
    },
    [nav, resume],
  );

  return { open, resume, list: () => router.push("/chats"), newChat: () => nav.newAgentRun() };
}
