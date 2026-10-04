import { useCallback, useContext, useEffect, useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { useAnimatedStyle, useDerivedValue, useSharedValue, withSpring } from "react-native-reanimated";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import type { Transforms3d } from "@shopify/react-native-skia";

import { useAppTheme } from "@/hooks/use-app-theme";
import { playHaptic } from "@/lib/haptics";

import type { OrbDock, Point } from "../types";
import {
  ISLAND_ORB_BOTTOM_CLEARANCE,
  ISLAND_ORB_DRAG_SLOP,
  ISLAND_ORB_FLING_PROJECTION,
  ISLAND_ORB_LIFT_SCALE,
  ISLAND_ORB_SHEEN_PER_POINT,
  ISLAND_ORB_SIZE,
} from "../utils/constants";
import { dockPoint, nearestDock, type OrbBounds } from "../utils/placement";

const SPRING = { damping: 20, stiffness: 240, mass: 0.9 };
const LIFT_SPRING = { damping: 14, stiffness: 320 };

const samePoint = (a: Point, b: Point) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

/**
 * Lets the orb be dragged anywhere and flung; on release it docks to the
 * nearest screen edge, keeping its place along it. Also drives the lift while
 * held and the bezel reflections that turn as it moves.
 */
export function useOrbDrag(dock: OrbDock, onDock: (dock: OrbDock) => void) {
  const theme = useAppTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const { width, height } = useWindowDimensions();
  const top = insets?.top ?? 0;
  const bottom = insets?.bottom ?? 0;

  const bounds = useMemo<OrbBounds>(
    () => ({
      left: theme.spacing.base,
      right: width - theme.spacing.base - ISLAND_ORB_SIZE,
      top: top + theme.spacing.sm,
      bottom: height - bottom - ISLAND_ORB_BOTTOM_CLEARANCE - ISLAND_ORB_SIZE,
    }),
    [theme.spacing.base, theme.spacing.sm, width, height, top, bottom],
  );

  const home = dockPoint(dock, bounds);
  const x = useSharedValue(home.x);
  const y = useSharedValue(home.y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startSheen = useSharedValue(0);
  const sheen = useSharedValue(0);
  const lift = useSharedValue(0);
  const target = useSharedValue<Point>(home);

  useEffect(() => {
    const point = dockPoint(dock, bounds);
    if (samePoint(target.get(), point)) return;
    target.set(point);
    x.set(withSpring(point.x, SPRING));
    y.set(withSpring(point.y, SPRING));
  }, [dock, bounds, x, y, target]);

  const settle = useCallback(
    (next: OrbDock) => {
      playHaptic("selection");
      onDock(next);
    },
    [onDock],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(ISLAND_ORB_DRAG_SLOP)
        .onStart(() => {
          startX.set(x.get());
          startY.set(y.get());
          startSheen.set(sheen.get());
          lift.set(withSpring(1, LIFT_SPRING));
          scheduleOnRN(playHaptic, "tap");
        })
        .onUpdate((event) => {
          x.set(Math.min(Math.max(startX.get() + event.translationX, 0), width - ISLAND_ORB_SIZE));
          y.set(Math.min(Math.max(startY.get() + event.translationY, top), height - ISLAND_ORB_SIZE));
          sheen.set(startSheen.get() + (event.translationX - event.translationY) * ISLAND_ORB_SHEEN_PER_POINT);
        })
        .onEnd((event) => {
          const next = nearestDock(
            {
              x: x.get() + event.velocityX * ISLAND_ORB_FLING_PROJECTION,
              y: y.get() + event.velocityY * ISLAND_ORB_FLING_PROJECTION,
            },
            bounds,
          );
          const point = dockPoint(next, bounds);
          target.set(point);
          x.set(withSpring(point.x, { ...SPRING, velocity: event.velocityX }));
          y.set(withSpring(point.y, { ...SPRING, velocity: event.velocityY }));
          sheen.set(withSpring(sheen.get() + event.velocityX * ISLAND_ORB_SHEEN_PER_POINT * ISLAND_ORB_FLING_PROJECTION, SPRING));
          scheduleOnRN(settle, next);
        })
        .onFinalize(() => {
          lift.set(withSpring(0, LIFT_SPRING));
        }),
    [x, y, startX, startY, startSheen, sheen, lift, target, bounds, width, height, top, settle],
  );

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() },
      { scale: 1 + (ISLAND_ORB_LIFT_SCALE - 1) * lift.get() },
    ],
  }));

  const sheenTransform = useDerivedValue<Transforms3d>(() => [{ rotate: sheen.get() }]);

  const card =
    home.y + ISLAND_ORB_SIZE / 2 < height / 2
      ? { top: home.y + ISLAND_ORB_SIZE + theme.spacing.sm, transformOrigin: "top" as const }
      : { bottom: height - home.y + theme.spacing.sm, transformOrigin: "bottom" as const };

  return { pan, style, lift, sheenTransform, card };
}
