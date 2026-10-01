import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { router, usePathname, type Href } from "expo-router";

import { useActiveSandbox } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { subscribeInboxEvents } from "../api/events";
import { findPushSandbox } from "../api/push";
import { prepareNotifications, presentInboxNotification, subscribeNotificationTaps } from "../notifications";
import { INBOX_ROUTE, PRESENTED_ITEMS_LIMIT } from "../utils/constants";
import { notificationKey, parseNotificationData, shouldNotify } from "../utils/notify";

export function useInboxNotifications(): void {
  const sandbox = useActiveSandbox();
  const setActive = useSandboxStore((state) => state.setActive);
  const nav = useSandboxNavigation();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const seen = useRef(new Set<string>());
  const sandboxId = sandbox?.id ?? null;

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    prepareNotifications();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || !sandboxId) return;
    return subscribeInboxEvents((eventSandboxId, event) => {
      if (eventSandboxId !== sandboxId) return;
      const context = { appState: AppState.currentState, pathname: pathRef.current, seen: seen.current };
      if (!shouldNotify(event.item, context)) return;
      seen.current.add(notificationKey(event.item));
      if (seen.current.size > PRESENTED_ITEMS_LIMIT) {
        const oldest = seen.current.values().next().value;
        if (oldest !== undefined) seen.current.delete(oldest);
      }
      presentInboxNotification(event.item, sandboxId).catch(() => undefined);
    });
  }, [sandboxId]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    const unsubscribe = subscribeNotificationTaps((raw) => {
      const data = parseNotificationData(raw);
      if (!data) return;
      void findPushSandbox(data.sandboxId)
        .catch(() => null)
        .then((target) => {
          if (!active) return;
          if (target && target !== useSandboxStore.getState().activeId) setActive(target);
          if (data.artifactId) nav.files(data.artifactId);
          else if (pathRef.current !== INBOX_ROUTE) router.push(INBOX_ROUTE as Href);
        });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [nav, setActive]);
}
