import { useCallback, useEffect, useMemo, useState } from "react";
import { useWindowDimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Durations, Easings, Springs } from "@/theme";

import { DRAWER_PAN_SLOP, dragProgress, drawerWidth, shouldCloseDrawer } from "./utils/geometry";

export function useSideDrawer(visible: boolean, onClose: () => void, onClosed?: () => void) {
  const { width: windowWidth } = useWindowDimensions();
  const width = drawerWidth(windowWidth);
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);

  if (visible && !mounted) setMounted(true);

  const unmount = useCallback(() => {
    setMounted(false);
    onClosed?.();
  }, [onClosed]);

  useEffect(() => {
    if (!mounted) return;
    const duration = reducedMotion ? Durations.instant : visible ? Durations.slow : Durations.normal;
    const [x1, y1, x2, y2] = visible ? Easings.decelerate : Easings.accelerate;
    const easing = Easing.bezier(x1, y1, x2, y2);
    progress.set(
      withTiming(visible ? 1 : 0, { duration, easing }, (finished) => {
        if (finished && !visible) scheduleOnRN(unmount);
      }),
    );
  }, [visible, mounted, reducedMotion, progress, unmount]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-DRAWER_PAN_SLOP, DRAWER_PAN_SLOP])
        .failOffsetY([-DRAWER_PAN_SLOP, DRAWER_PAN_SLOP])
        .onUpdate((event) => {
          progress.set(dragProgress(event.translationX, width));
        })
        .onEnd((event) => {
          if (shouldCloseDrawer(progress.get(), event.velocityX)) scheduleOnRN(onClose);
          else progress.set(withSpring(1, Springs.snappy));
        }),
    [progress, width, onClose],
  );

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.get(), [0, 1], [-width, 0]) }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));

  return { mounted, width, pan, panelStyle, scrimStyle };
}
