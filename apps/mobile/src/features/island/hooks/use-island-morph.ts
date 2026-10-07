import { useContext, useEffect } from "react";
import { useWindowDimensions } from "react-native";
import {
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";

import {
  ISLAND_CAPSULE_FADE,
  ISLAND_CAPSULE_HEIGHT,
  ISLAND_CAPSULE_WIDTH,
  ISLAND_CLOSE_SPRING,
  ISLAND_OPEN_SPRING,
  ISLAND_ORB_LIFT_SCALE,
  ISLAND_PANEL_ENTER_SCALE,
  ISLAND_PANEL_FADE,
  ISLAND_PANEL_MAX_WIDTH,
  ISLAND_PANEL_RADIUS,
} from "../utils/constants";

/**
 * Springs the capsule at (`x`, `y`) into the expanded panel and back, the way
 * the Dynamic Island grows: width, height, corners and position move together,
 * the capsule content fades out first and the panel content fades in once the
 * shape has nearly settled. The panel opens away from the screen edge the
 * capsule rests nearest to and always stays inside the safe area.
 */
export function useIslandMorph(
  expanded: boolean,
  x: SharedValue<number>,
  y: SharedValue<number>,
  lift: SharedValue<number>,
  panelHeight: number,
) {
  const theme = useAppTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    const spring = expanded ? ISLAND_OPEN_SPRING : ISLAND_CLOSE_SPRING;
    progress.set(withSpring(expanded ? 1 : 0, { ...spring, reduceMotion: ReduceMotion.System }));
  }, [expanded, progress]);

  const panelWidth = Math.min(width - theme.spacing.base * 2, ISLAND_PANEL_MAX_WIDTH);
  const panelX = (width - panelWidth) / 2;
  const minTop = (insets?.top ?? 0) + theme.spacing.sm;
  const maxTop = height - (insets?.bottom ?? 0) - theme.spacing.base - panelHeight;

  const frame = useAnimatedStyle(() => {
    const p = progress.get();
    const capsuleY = y.get();
    const below = capsuleY + ISLAND_CAPSULE_HEIGHT / 2 < height / 2;
    const panelY = below ? Math.min(capsuleY, maxTop) : Math.max(capsuleY + ISLAND_CAPSULE_HEIGHT - panelHeight, minTop);
    return {
      width: Math.max(interpolate(p, [0, 1], [ISLAND_CAPSULE_WIDTH, panelWidth]), ISLAND_CAPSULE_HEIGHT),
      height: Math.max(interpolate(p, [0, 1], [ISLAND_CAPSULE_HEIGHT, panelHeight]), ISLAND_CAPSULE_HEIGHT),
      borderRadius: interpolate(p, [0, 1], [ISLAND_CAPSULE_HEIGHT / 2, ISLAND_PANEL_RADIUS], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(p, [0, 1], [x.get(), panelX]) },
        { translateY: interpolate(p, [0, 1], [capsuleY, panelY]) },
        { scale: 1 + (ISLAND_ORB_LIFT_SCALE - 1) * lift.get() },
      ],
    };
  });

  const clip = useAnimatedStyle(() => ({
    borderRadius: interpolate(progress.get(), [0, 1], [ISLAND_CAPSULE_HEIGHT / 2, ISLAND_PANEL_RADIUS], Extrapolation.CLAMP),
  }));

  const capsule = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), ISLAND_CAPSULE_FADE, [1, 0], Extrapolation.CLAMP),
  }));

  const panel = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: interpolate(p, ISLAND_PANEL_FADE, [0, 1], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(p, ISLAND_PANEL_FADE, [ISLAND_PANEL_ENTER_SCALE, 1], Extrapolation.CLAMP) }],
    };
  });

  return { frame, clip, capsule, panel, panelWidth, panelHeight };
}
