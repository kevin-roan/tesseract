import { useCallback, useEffect, useMemo, useState } from "react";
import { useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { GlassToolbarAction } from "@/components/glass-toolbar";
import { useFullscreen } from "@/features/sandbox/hooks/use-fullscreen";
import { usePageInsetsSync } from "@/features/sandbox/hooks/use-page-insets-sync";
import { useWebPageSession } from "@/features/sandbox/hooks/use-web-page-session";
import { DISPLAY_ACTIONS, PAGE_ACTIONS } from "@/features/sandbox/utils/actions";
import { displayInsets } from "@/features/sandbox/utils/display";
import { pageTone, stateLabel } from "@/features/sandbox/utils/states";
import { useRotationToggle } from "@/hooks/use-orientation-lock";
import { originOf } from "@/lib/url";

import { hostKeys } from "../api/query-keys";
import { useHostSessionStore } from "../store/host-session-store";
import { androidScreenMaxSize, deviceLabel } from "../utils/android";
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
  const { serial } = useLocalSearchParams<{ serial?: string }>();

  const target = useMemo(
    () => ({
      key: host && session ? [...hostKeys.page(host.baseUrl, session.session, HOST_NEXT.android), serial ?? null] : hostKeys.root,
      client: sessionClient,
      origin: host ? originOf(host.baseUrl) : null,
    }),
    [host, session, sessionClient, serial],
  );
  const page = useWebPageSession(
    "android",
    HOST_NEXT.android,
    (client) => client.androidScreenPageUrl(maxSize, serial),
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

  const safeArea = useSafeAreaInsets();
  const rotation = useRotationToggle();
  const { fullscreen, enter: enterFullscreen, exit: exitFullscreen } = useFullscreen();
  const [barBottom, setBarBottom] = useState(0);
  const insets = useMemo(() => displayInsets({ barBottom, safeBottom: safeArea.bottom, fullscreen }), [barBottom, safeArea.bottom, fullscreen]);
  usePageInsetsSync(page.surfaceRef, page.connection, insets);

  const onBarLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setBarBottom(y + height);
  }, []);

  const { reconnect } = page;
  const barActions = useMemo<GlassToolbarAction[]>(
    () => [
      ...(rotation.supported ? [{ ...DISPLAY_ACTIONS.rotate, onPress: rotation.toggle, selected: rotation.landscape }] : []),
      { ...DISPLAY_ACTIONS.fullscreen, onPress: enterFullscreen },
      { ...PAGE_ACTIONS.reconnect, onPress: reconnect },
    ],
    [rotation.supported, rotation.toggle, rotation.landscape, enterFullscreen, reconnect],
  );
  const emulator = status.data?.emulator;
  const device = status.data?.devices.find((item) => item.serial === serial);
  const name = device && !device.hostEmulator ? deviceLabel(device) : emulator?.avd;

  return {
    nav,
    page,
    barActions,
    exitFullscreenAction: { ...DISPLAY_ACTIONS.exitFullscreen, onPress: exitFullscreen },
    fullscreen,
    safeArea,
    onBarLayout,
    title: ANDROID_COPY.screenTitle,
    subtitle: [name, host?.name].filter(Boolean).join(" · ") || undefined,
    badge: { label: stateLabel(page.connection), tone: pageTone(page.connection) },
  };
}
