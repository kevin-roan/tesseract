import { useMemo } from "react";
import { router } from "expo-router";

import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useProjects } from "@/features/sandbox/hooks/use-sandbox-queries";
import { useSandboxRefresh } from "@/features/sandbox/hooks/use-sandbox-refresh";
import { describeError } from "@/features/sandbox/utils/errors";

import { CHAT_LIST_LIMIT } from "../utils/constants";
import { projectLabel, projectNames } from "../utils/sessions";
import { useChatNavigation } from "./use-chat-navigation";
import { useSessions } from "./use-sessions";

export function useChatsScreen(projectId: string | null = null) {
  const { sandbox, hydrated } = useSandboxClient();
  const nav = useSandboxNavigation();
  const chats = useChatNavigation();
  const sessions = useSessions({ limit: CHAT_LIST_LIMIT, ...(projectId ? { projectId } : {}) });
  const projects = useProjects();
  const { refreshing, refresh } = useSandboxRefresh();
  const names = useMemo(() => projectNames(projects.data), [projects.data]);

  return {
    hydrated,
    paired: sandbox !== null,
    back: () => (router.canGoBack() ? router.back() : router.replace("/")),
    project: projectLabel(projectId, names),
    items: sessions.data ?? [],
    loading: sessions.isLoading,
    error: sessions.error ? describeError(sessions.error) : null,
    retry: () => void sessions.refetch(),
    open: chats.open,
    newChat: () => nav.newAgentRun(projectId ?? undefined),
    projectName: (id: string | null) => (projectId ? null : projectLabel(id, names)),
    refreshing,
    refresh,
  };
}
