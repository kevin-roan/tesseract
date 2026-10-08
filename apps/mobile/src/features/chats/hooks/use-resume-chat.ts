import { useCallback, useMemo } from "react";
import { router } from "expo-router";
import type { AgentRun } from "@tesseract/protocol";

import { useChatComposer } from "@/features/chat/hooks/use-chat-composer";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useProjects } from "@/features/sandbox/hooks/use-sandbox-queries";
import { describeError } from "@/features/sandbox/utils/errors";

import { CHAT_LIST_LIMIT } from "../utils/constants";
import { projectLabel, projectNames, sessionTitle } from "../utils/sessions";
import { useSessions } from "./use-sessions";

export function useResumeChat(sessionId: string) {
  const nav = useSandboxNavigation();
  const sessions = useSessions({ limit: CHAT_LIST_LIMIT });
  const projects = useProjects();
  const session = useMemo(
    () => sessions.data?.find((entry) => entry.sessionId === sessionId) ?? null,
    [sessions.data, sessionId],
  );
  const onStarted = useCallback((run: AgentRun) => nav.replaceWithAgentRun(run.id), [nav]);
  const composer = useChatComposer({
    defaultProjectId: session?.projectId ?? null,
    resumeSessionId: sessionId || null,
    onStarted,
  });
  const names = useMemo(() => projectNames(projects.data), [projects.data]);

  return {
    back: () => (router.canGoBack() ? router.back() : router.replace("/chats")),
    session,
    title: session ? sessionTitle(session) : "Continue chat",
    project: session ? projectLabel(session.projectId, names) : null,
    loading: sessions.isLoading,
    error: sessions.error ? describeError(sessions.error) : null,
    composer,
  };
}
