import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Platform } from "react-native";
import { useNavigation } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";

const canLock = Platform.OS !== "web";

function lock(orientation: ScreenOrientation.OrientationLock): void {
  if (!canLock) return;
  ScreenOrientation.lockAsync(orientation).catch(() => undefined);
}

/** Keeps the app upright. Screens that rotate take over with `useRotationToggle`. */
export function usePortraitLock(): void {
  useEffect(() => lock(ScreenOrientation.OrientationLock.PORTRAIT_UP), []);
}

/**
 * Lets a screen flip between portrait and landscape. Drives the native stack's
 * per-screen `orientation` rather than `lockAsync`: on iOS the root controller
 * defers to react-native-screens once a screen sets one, and a lock from
 * both sides leaves the window stuck mid-rotation. Popping the screen hands
 * orientation back to the stack. Unsupported (and hidden) on web.
 */
export function useRotationToggle() {
  const navigation = useNavigation();
  const [landscape, setLandscape] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ orientation: landscape ? "landscape" : "portrait_up" });
  }, [navigation, landscape]);

  const toggle = useCallback(() => setLandscape((previous) => !previous), []);

  return { supported: canLock, landscape, toggle };
}
