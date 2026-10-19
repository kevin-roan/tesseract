import { useCallback, useEffect, useMemo, useState } from "react";
import { useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TesseractClient } from "@tesseract/client";

import type { GlassToolbarAction } from "@/components/glass-toolbar";
import { useFullscreen } from "@/features/sandbox/hooks/use-fullscreen";
import { usePageImmersiveSync, usePageInsetsSync } from "@/features/sandbox/hooks/use-page-insets-sync";
import { useWebPageSession } from "@/features/sandbox/hooks/use-web-page-session";
import { DISPLAY_ACTIONS, PAGE_ACTIONS } from "@/features/sandbox/utils/actions";
import { displayInsets } from "@/features/sandbox/utils/display";
import { pageTone, stateLabel } from "@/features/sandbox/utils/states";
import { useRotationToggle } from "@/hooks/use-orientation-lock";
import { originOf } from "@/lib/url";

import { hostKeys } from "../api/query-keys";
import { useHostSessionStore } from "../store/host-session-store";
import type { HostDeviceKind } from "../types";
import { androidScreenName } from "../utils/android";
import { HOST_DEVICE_COPY, HOST_SCREEN } from "../utils/content";
import { HOST_DEVICES } from "../utils/devices";
import { isSessionLost } from "../utils/errors";
import { iosScreenName } from "../utils/ios";
import { useHostAndroidStatus } from "./use-host-android-status";
import { useHostClient } from "./use-host-client";
import { useHostIosStatus } from "./use-host-ios-status";
import { useHostNavigation } from "./use-host-navigation";

const UNSUPPORTED = new Error(HOST_DEVICE_COPY.unsupported);

export function useHostDeviceScreen(kind: HostDeviceKind) {
  const nav = useHostNavigation();
  const spec = HOST_DEVICES[kind];
  const { host, hydrated, session, sessionClient } = useHostClient();
  const clear = useHostSessionStore((state) => state.clear);
  const { status: android } = useHostAndroidStatus(sessionClient !== null && kind === "android");
  const { status: ios } = useHostIosStatus(sessionClient !== null && kind === "ios");
  const window = useWindowDimensions();
  const [maxSize] = useState(() => spec?.maxSize(window.width, window.height, window.scale) ?? 0);
  const { serial } = useLocalSearchParams<{ serial?: string }>();

  const target = useMemo(
    () => ({
      key: host && session ? [...hostKeys.page(host.baseUrl, session.session, kind), serial ?? null] : hostKeys.root,
      client: sessionClient,
      origin: host ? originOf(host.baseUrl) : null,
    }),
    [host, session, sessionClient, kind, serial],
  );
  const build = useCallback(
    (client: TesseractClient) => (spec ? spec.pageUrl(client, maxSize, serial) : Promise.reject(UNSUPPORTED)),
    [spec, maxSize, serial],
  );
  const page = useWebPageSession(kind, kind, build, sessionClient !== null && spec !== null, undefined, target);

  useEffect(() => {
    if (isSessionLost(page.error)) clear();
  }, [page.error, clear]);

  const { unlockForScreen } = nav;
  useEffect(() => {
    if (hydrated && !session) unlockForScreen({ kind, serial });
  }, [hydrated, session, unlockForScreen, kind, serial]);

  const safeArea = useSafeAreaInsets();
  const rotation = useRotationToggle();
  const { fullscreen, enter: enterFullscreen, exit: exitFullscreen } = useFullscreen();
  const [barBottom, setBarBottom] = useState(0);
  const insets = useMemo(() => displayInsets({ barBottom, safeBottom: safeArea.bottom, fullscreen }), [barBottom, safeArea.bottom, fullscreen]);
  usePageInsetsSync(page.surfaceRef, page.connection, insets);
  usePageImmersiveSync(page.surfaceRef, page.connection, fullscreen);

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
  const name = kind === "android" ? androidScreenName(android.data, serial) : iosScreenName(ios.data, serial);
  const title = spec?.title ?? HOST_SCREEN.title;

  return {
    nav,
    page: spec ? page : { ...page, error: UNSUPPORTED, isLoading: false },
    barActions,
    exitFullscreenAction: { ...DISPLAY_ACTIONS.exitFullscreen, onPress: exitFullscreen },
    fullscreen,
    safeArea,
    onBarLayout,
    title,
    subtitle: [name, host?.name].filter(Boolean).join(" · ") || undefined,
    badge: { label: stateLabel(page.connection), tone: pageTone(page.connection) },
  };
}

export type HostDeviceScreenState = ReturnType<typeof useHostDeviceScreen>;
