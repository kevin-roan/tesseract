import { router } from "expo-router";

import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { describeError } from "@/features/sandbox/utils/errors";

import { RECENT_CHATS_LIMIT } from "../utils/constants";
import { useChatNavigation } from "./use-chat-navigation";
import { useSessions } from "./use-sessions";

export function useProjectChats(projectId: string) {
  const nav = useSandboxNavigation();
  const chats = useChatNavigation();
  const sessions = useSessions({ projectId, limit: RECENT_CHATS_LIMIT + 1 });
  const all = sessions.data ?? [];

  return {
    items: all.slice(0, RECENT_CHATS_LIMIT),
    loading: sessions.isLoading,
    error: sessions.error ? describeError(sessions.error) : null,
    retry: () => void sessions.refetch(),
    open: chats.open,
    newChat: () => nav.newAgentRun(projectId),
    viewAll: all.length > RECENT_CHATS_LIMIT ? () => router.push({ pathname: "/chats", params: { projectId } }) : undefined,
  };
}
