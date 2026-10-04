import { useEffect, useMemo, useState } from "react";
import { useWindowDimensions } from "react-native";

import type { HeaderAction } from "@/components/screen-header";
import { useWebPageSession } from "@/features/sandbox/hooks/use-web-page-session";
import { PAGE_ACTIONS } from "@/features/sandbox/utils/actions";
import { pageTone, stateLabel } from "@/features/sandbox/utils/states";
import { originOf } from "@/lib/url";

import { hostKeys } from "../api/query-keys";
import { useHostSessionStore } from "../store/host-session-store";
import { androidScreenMaxSize } from "../utils/android";
import { HOST_NEXT } from "../utils/constants";
import { ANDROID_COPY } from "../utils/content";
import { isSessionLost } from "../utils/errors";
import { useHostAndroidStatus } from "./use-host-android-status";
import { useHostClient } from "./use-host-client";
import { useHostNavigation } from "./use-host-navigation";

export function useHostAndroidScreen() {
  const nav = useHostNavigation();
  const { host, hydrated, session, sessionClient } = useHostClient();
  const clear = useHostSessionStore((state) => state.clear);
  const { status } = useHostAndroidStatus(sessionClient !== null);
  const window = useWindowDimensions();
  const [maxSize] = useState(() => androidScreenMaxSize(window.width, window.height, window.scale));

  const target = useMemo(
    () => ({
      key: host && session ? hostKeys.page(host.baseUrl, session.session, HOST_NEXT.android) : hostKeys.root,
      client: sessionClient,
      origin: host ? originOf(host.baseUrl) : null,
    }),
    [host, session, sessionClient],
  );
  const page = useWebPageSession(
    "android",
    HOST_NEXT.android,
    (client) => client.androidScreenPageUrl(maxSize),
    sessionClient !== null,
    undefined,
    target,
  );

  useEffect(() => {
    if (isSessionLost(page.error)) clear();
  }, [page.error, clear]);

  const { unlockForAndroid } = nav;
  useEffect(() => {
    if (hydrated && !session) unlockForAndroid();
  }, [hydrated, session, unlockForAndroid]);

  const { reconnect } = page;
  const headerActions = useMemo<HeaderAction[]>(() => [{ ...PAGE_ACTIONS.reconnect, onPress: reconnect }], [reconnect]);
  const emulator = status.data?.emulator;

  return {
    nav,
    page,
    headerActions,
    title: ANDROID_COPY.screenTitle,
    subtitle: [emulator?.avd, host?.name].filter(Boolean).join(" · ") || undefined,
    badge: { label: stateLabel(page.connection), tone: pageTone(page.connection) },
  };
}
