import { useCallback, useMemo } from "react";
import { router } from "expo-router";
import type { InboxItem } from "@theone/protocol";

import type { HeaderAction } from "@/components/screen-header";
import { useChatNavigation } from "@/features/chats/hooks/use-chat-navigation";
import { useFileDownload } from "@/features/files/hooks/use-file-download";
import { projectLabel, projectNames } from "@/features/chats/utils/sessions";
import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useProjects } from "@/features/sandbox/hooks/use-sandbox-queries";
import { useSandboxRefresh } from "@/features/sandbox/hooks/use-sandbox-refresh";
import { describeError } from "@/features/sandbox/utils/errors";

import { groupInbox, inboxTarget, isUnread, type InboxTarget } from "../utils/group";
import { INBOX_ACTIONS } from "../utils/actions";
import { useInbox, useMarkInboxRead } from "./use-inbox";

export function useInboxScreen() {
  const nav = useSandboxNavigation();
  const chats = useChatNavigation();
  const { sandbox, hydrated } = useSandboxClient();
  const inbox = useInbox();
  const projects = useProjects();
  const markRead = useMarkInboxRead();
  const files = useFileDownload();
  const { refreshing, refresh } = useSandboxRefresh();
  const { mutate } = markRead;
  const { download } = files;

  const sections = useMemo(() => groupInbox(inbox.data?.items ?? []), [inbox.data]);
  const names = useMemo(() => projectNames(projects.data), [projects.data]);
  const unreadCount = inbox.data?.unreadCount ?? 0;

  const go = useCallback(
    (target: InboxTarget | null) => {
      if (!target) return;
      if (target.kind === "file") download(target.id);
      else if (target.kind === "agentRun") nav.agentRun(target.id);
      else if (target.kind === "terminal") nav.terminal(target.id);
      else if (target.kind === "chat") chats.resume(target.id);
      else nav.project(target.id);
    },
    [nav, chats, download],
  );

  const open = useCallback(
    (item: InboxItem) => {
      if (isUnread(item)) mutate({ ids: [item.id] });
      go(inboxTarget(item));
    },
    [mutate, go],
  );

  const markOne = useCallback((item: InboxItem) => {
    if (isUnread(item)) mutate({ ids: [item.id] });
  }, [mutate]);

  const headerActions = useMemo<HeaderAction[]>(
    () =>
      unreadCount > 0
        ? [{ ...INBOX_ACTIONS.markAllRead, onPress: () => mutate({ all: true }), disabled: markRead.isPending }]
        : [],
    [unreadCount, mutate, markRead.isPending],
  );

  return {
    hydrated,
    paired: sandbox !== null,
    back: () => (router.canGoBack() ? router.back() : router.replace("/")),
    pair: nav.pair,
    sections,
    projectName: (projectId: string | null) => projectLabel(projectId, names),
    unreadCount,
    attentionCount: inbox.data?.attentionCount ?? 0,
    loading: inbox.isLoading,
    error: inbox.error ? describeError(inbox.error) : null,
    retry: () => void inbox.refetch(),
    markError: markRead.error ? describeError(markRead.error) : null,
    downloadError: files.error,
    downloadingId: files.pendingId,
    open,
    markOne,
    headerActions,
    refreshing,
    refresh,
  };
}
