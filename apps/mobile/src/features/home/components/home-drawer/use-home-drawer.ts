import { useCallback, useMemo, useRef } from "react";
import { router, type Href } from "expo-router";

import { useChatNavigation } from "@/features/chats/hooks/use-chat-navigation";
import { useSessions } from "@/features/chats/hooks/use-sessions";
import { sessionTitle } from "@/features/chats/utils/sessions";
import { useInbox } from "@/features/inbox/hooks/use-inbox";
import { INBOX_ROUTE } from "@/features/inbox/utils/constants";
import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useSandboxIdentity } from "@/features/sandbox/hooks/use-sandbox-queries";
import { profileView } from "@/features/sandbox/utils/profile";

import { DRAWER_NAV, DRAWER_RECENTS_LIMIT, DRAWER_ROUTES, type DrawerNavId } from "./constants";

const navigate = (route: string) => () => router.navigate(route as Href);
const push = (route: string) => () => router.push(route as Href);

export function useHomeDrawer(onClose: () => void) {
  const nav = useSandboxNavigation();
  const chats = useChatNavigation();
  const { sandbox } = useSandboxClient();
  const identity = useSandboxIdentity();
  const sessions = useSessions({ limit: DRAWER_RECENTS_LIMIT });
  const inbox = useInbox();
  const pending = useRef<(() => void) | null>(null);

  const go = useCallback(
    (action: () => void) => () => {
      pending.current = action;
      onClose();
    },
    [onClose],
  );

  const onClosed = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    action?.();
  }, []);

  const unread = inbox.data?.unreadCount ?? 0;

  const items = useMemo(() => {
    const handlers: Record<DrawerNavId, () => void> = {
      chats: push(DRAWER_ROUTES.chats),
      projects: navigate(DRAWER_ROUTES.projects),
      agents: navigate(DRAWER_ROUTES.agents),
      tasks: navigate(DRAWER_ROUTES.tasks),
      analytics: push(DRAWER_ROUTES.analytics),
      files: () => nav.files(),
      inbox: push(INBOX_ROUTE),
    };
    return DRAWER_NAV.map((item) => ({
      ...item,
      badge: item.id === "inbox" ? unread : undefined,
      onPress: go(handlers[item.id]),
    }));
  }, [nav, go, unread]);

  const recents = useMemo(
    () =>
      (sessions.data ?? []).map((session) => ({
        id: session.sessionId,
        title: sessionTitle(session),
        onPress: go(() => chats.open(session)),
      })),
    [sessions.data, chats, go],
  );

  const profile = sandbox ? profileView(identity.data, sandbox) : null;

  return {
    items,
    recents,
    user: { name: profile?.name ?? "", photo: profile?.photo },
    onClosed,
    allChats: go(chats.list),
    openProfile: go(navigate(DRAWER_ROUTES.profile)),
    openSettings: go(nav.settings),
  };
}
