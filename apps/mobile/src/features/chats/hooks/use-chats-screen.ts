import { useMemo } from "react";
import { router } from "expo-router";

import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useProjects } from "@/features/sandbox/hooks/use-sandbox-queries";
import { useSandboxRefresh } from "@/features/sandbox/hooks/use-sandbox-refresh";
import { describeError } from "@/features/sandbox/utils/errors";

import { CHAT_LIST_LIMIT } from "../utils/constants";
import { projectLabel, projectNames } from "../utils/sessions";
import { useChatNavigation } from "./use-chat-navigation";
import { useSessions } from "./use-sessions";

export function useChatsScreen() {
  const { sandbox, hydrated } = useSandboxClient();
  const chats = useChatNavigation();
  const sessions = useSessions({ limit: CHAT_LIST_LIMIT });
  const projects = useProjects();
  const { refreshing, refresh } = useSandboxRefresh();
  const names = useMemo(() => projectNames(projects.data), [projects.data]);

  return {
    hydrated,
    paired: sandbox !== null,
    back: () => (router.canGoBack() ? router.back() : router.replace("/")),
    items: sessions.data ?? [],
    loading: sessions.isLoading,
    error: sessions.error ? describeError(sessions.error) : null,
    retry: () => void sessions.refetch(),
    open: chats.open,
    newChat: chats.newChat,
    projectName: (projectId: string | null) => projectLabel(projectId, names),
    refreshing,
    refresh,
  };
}
