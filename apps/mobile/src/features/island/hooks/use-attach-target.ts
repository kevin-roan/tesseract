import { useCallback, useMemo } from "react";
import { router } from "expo-router";

import { useSessions } from "@/features/chats/hooks/use-sessions";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useProjects } from "@/features/sandbox/hooks/use-sandbox-queries";

import { useIslandStore } from "../store/island-store";
import type { AttachDestination } from "../types";
import { RECENT_CHATS_LIMIT } from "../utils/constants";
import { attachDestinations, NEW_CHAT_DESTINATION } from "../utils/destinations";

export type AttachTargetState = ReturnType<typeof useAttachTarget>;

export function useAttachTarget() {
  const nav = useSandboxNavigation();
  const visible = useIslandStore((state) => state.attachOpen);
  const draft = useIslandStore((state) => state.stagedDraft);
  const close = useIslandStore((state) => state.closeAttach);
  const setPendingDraft = useIslandStore((state) => state.setPendingDraft);
  const projects = useProjects();
  const sessions = useSessions({ limit: RECENT_CHATS_LIMIT });

  const destinations = useMemo(() => attachDestinations(projects.data, sessions.data), [projects.data, sessions.data]);

  const select = useCallback(
    (destination: AttachDestination) => {
      if (!draft) return;
      setPendingDraft(draft);
      close();
      if (destination.kind === "project") nav.newAgentRun(destination.id);
      else if (destination.kind === "chat") router.push({ pathname: "/chats/[id]", params: { id: destination.id } });
      else router.navigate("/");
    },
    [draft, setPendingDraft, close, nav],
  );

  return {
    visible,
    draft,
    newChat: NEW_CHAT_DESTINATION,
    projects: destinations.projects,
    chats: destinations.chats,
    loading: projects.isLoading || sessions.isLoading,
    select,
    close,
  };
}
