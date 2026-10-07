import { useCallback, useMemo } from "react";
import { router, type Href } from "expo-router";
import type { AgentRun } from "@theone/protocol";

import { useChatComposer } from "@/features/chat/hooks/use-chat-composer";
import { useProjectOptions } from "@/features/chat/hooks/use-project-options";
import { useInbox } from "@/features/inbox/hooks/use-inbox";
import { INBOX_ROUTE } from "@/features/inbox/utils/constants";
import { attentionTitle } from "@/features/inbox/utils/group";
import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useSandboxIdentity } from "@/features/sandbox/hooks/use-sandbox-queries";
import { profilePerson } from "@/features/sandbox/utils/profile";

import { homeStatus } from "../utils/status";
import { useActiveBuild } from "./use-active-build";
import { useDrawerState } from "./use-drawer-state";
import { useRunningTasks } from "./use-running-tasks";
import { useSandboxUnreachable } from "./use-sandbox-unreachable";

export function useHomeScreen() {
  const nav = useSandboxNavigation();
  const { sandbox, hydrated } = useSandboxClient();
  const inbox = useInbox();
  const identity = useSandboxIdentity();
  const build = useActiveBuild();
  const drawer = useDrawerState();
  const unreachable = useSandboxUnreachable();
  const running = useRunningTasks();

  const onStarted = useCallback((run: AgentRun) => nav.agentRun(run.id), [nav]);
  const projectOptions = useProjectOptions();
  const composer = useChatComposer({ projectOptions, onStarted });

  const unreadCount = inbox.data?.unreadCount ?? 0;
  const attention = attentionTitle(inbox.data?.attentionCount ?? 0);
  const openInbox = useCallback(() => router.push(INBOX_ROUTE as Href), []);

  const offline = useMemo(() => (unreachable ? { view: nav.sandboxHub } : null), [unreachable, nav.sandboxHub]);
  const status = useMemo(() => homeStatus({ offline, attention, openInbox, build }), [offline, attention, openInbox, build]);

  return {
    hydrated,
    paired: sandbox !== null,
    pair: nav.pair,
    name: profilePerson(identity.data)?.displayName ?? null,
    drawer,
    inbox: { unreadCount, attention, open: openInbox },
    status,
    running,
    composer,
  };
}
