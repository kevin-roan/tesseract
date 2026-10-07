import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { VncAction } from "@theone/protocol";

import type { GlassToolbarAction } from "@/components/glass-toolbar";
import { useRotationToggle } from "@/hooks/use-orientation-lock";

import { useDisplayStore } from "../store/display-store";
import { DISPLAY_ACTIONS, INPUT_MODE_ACTIONS } from "../utils/actions";
import { displayInsets, nextInputMode } from "../utils/display";
import { useDisplayPageSync } from "./use-display-page-sync";
import { useDisplayPaste } from "./use-display-paste";
import { useDisplaySession } from "./use-display-session";
import { useFullscreen } from "./use-fullscreen";

/**
 * Everything around the full-bleed VNC page: the floating bar's actions,
 * input mode, rotation, full screen, the browser sheet, and the insets the
 * page keeps clear of that chrome.
 */
export function useDisplayScreen() {
  const [browserOpen, setBrowserOpen] = useState(false);
  const [windowsOpen, setWindowsOpen] = useState(false);
  const { fullscreen, enter: enterFullscreen, exit: exitFullscreen } = useFullscreen();
  const [barBottom, setBarBottom] = useState(0);
  const safeArea = useSafeAreaInsets();
  const rotation = useRotationToggle();
  const inputMode = useDisplayStore((state) => state.inputMode);
  const setInputMode = useDisplayStore((state) => state.setInputMode);

  const pasteRef = useRef<(() => Promise<void>) | null>(null);

  const handleAction = useCallback((action: VncAction) => {
    if (action === "browser") setBrowserOpen(true);
    else if (action === "paste") void pasteRef.current?.();
  }, []);

  const display = useDisplaySession(handleAction);
  const paste = useDisplayPaste(display.session.surfaceRef);
  useEffect(() => {
    pasteRef.current = paste;
  }, [paste]);
  const insets = useMemo(
    () => displayInsets({ barBottom, safeBottom: safeArea.bottom, fullscreen }),
    [barBottom, safeArea.bottom, fullscreen],
  );

  useDisplayPageSync(display.session.surfaceRef, display.session.connection, insets, inputMode);

  const onBarLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setBarBottom(y + height);
  }, []);

  const openBrowser = useCallback(() => setBrowserOpen(true), []);
  const closeBrowser = useCallback(() => setBrowserOpen(false), []);
  const openWindows = useCallback(() => setWindowsOpen(true), []);
  const closeWindows = useCallback(() => setWindowsOpen(false), []);
  const toggleInputMode = useCallback(() => setInputMode(nextInputMode(inputMode)), [inputMode, setInputMode]);

  const barActions = useMemo<GlassToolbarAction[]>(
    () => [
      { ...INPUT_MODE_ACTIONS[inputMode], onPress: toggleInputMode },
      { ...DISPLAY_ACTIONS.windows, onPress: openWindows },
      { ...DISPLAY_ACTIONS.browser, onPress: openBrowser },
      ...(rotation.supported
        ? [{ ...DISPLAY_ACTIONS.rotate, onPress: rotation.toggle, selected: rotation.landscape }]
        : []),
      { ...DISPLAY_ACTIONS.fullscreen, onPress: enterFullscreen },
      ...display.headerActions,
    ],
    [inputMode, toggleInputMode, openWindows, openBrowser, rotation.supported, rotation.toggle, rotation.landscape, enterFullscreen, display.headerActions],
  );

  return {
    display,
    barActions,
    exitFullscreenAction: { ...DISPLAY_ACTIONS.exitFullscreen, onPress: exitFullscreen },
    safeArea,
    onBarLayout,
    fullscreen,
    inputMode,
    browser: { visible: browserOpen, open: openBrowser, close: closeBrowser },
    windows: { visible: windowsOpen, open: openWindows, close: closeWindows },
  };
}
