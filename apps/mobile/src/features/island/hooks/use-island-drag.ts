import { useCallback, useContext, useEffect, useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { useAppTheme } from "@/hooks/use-app-theme";
import { playHaptic } from "@/lib/haptics";

import type { OrbDock, Point } from "../types";
import {
  ISLAND_CAPSULE_HEIGHT,
  ISLAND_CAPSULE_WIDTH,
  ISLAND_DRAG_SPRING,
  ISLAND_LIFT_SPRING,
  ISLAND_ORB_BOTTOM_CLEARANCE,
  ISLAND_ORB_DRAG_SLOP,
  ISLAND_ORB_FLING_PROJECTION,
} from "../utils/constants";
import { dockPoint, nearestDock, type OrbBounds } from "../utils/placement";

const samePoint = (a: Point, b: Point) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

/**
 * Lets the collapsed capsule be dragged anywhere and flung; on release it docks
 * to the nearest screen edge, keeping its place along it. `lift` rises while it
 * is held. Dragging is off while the island is expanded.
 */
export function useIslandDrag(dock: OrbDock, onDock: (dock: OrbDock) => void, enabled: boolean) {
  const theme = useAppTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const { width, height } = useWindowDimensions();
  const top = insets?.top ?? 0;
  const bottom = insets?.bottom ?? 0;

  const bounds = useMemo<OrbBounds>(
    () => ({
      left: theme.spacing.base,
      right: width - theme.spacing.base - ISLAND_CAPSULE_WIDTH,
      top: top + theme.spacing.sm,
      bottom: height - bottom - ISLAND_ORB_BOTTOM_CLEARANCE - ISLAND_CAPSULE_HEIGHT,
    }),
    [theme.spacing.base, theme.spacing.sm, width, height, top, bottom],
  );

  const home = dockPoint(dock, bounds);
  const x = useSharedValue(home.x);
  const y = useSharedValue(home.y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const lift = useSharedValue(0);
  const target = useSharedValue<Point>(home);

  useEffect(() => {
    const point = dockPoint(dock, bounds);
    if (samePoint(target.get(), point)) return;
    target.set(point);
    x.set(withSpring(point.x, ISLAND_DRAG_SPRING));
    y.set(withSpring(point.y, ISLAND_DRAG_SPRING));
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
        .enabled(enabled)
        .minDistance(ISLAND_ORB_DRAG_SLOP)
        .onStart(() => {
          startX.set(x.get());
          startY.set(y.get());
          lift.set(withSpring(1, ISLAND_LIFT_SPRING));
          scheduleOnRN(playHaptic, "tap");
        })
        .onUpdate((event) => {
          x.set(Math.min(Math.max(startX.get() + event.translationX, 0), width - ISLAND_CAPSULE_WIDTH));
          y.set(Math.min(Math.max(startY.get() + event.translationY, top), height - ISLAND_CAPSULE_HEIGHT));
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
          x.set(withSpring(point.x, { ...ISLAND_DRAG_SPRING, velocity: event.velocityX }));
          y.set(withSpring(point.y, { ...ISLAND_DRAG_SPRING, velocity: event.velocityY }));
          scheduleOnRN(settle, next);
        })
        .onFinalize(() => {
          lift.set(withSpring(0, ISLAND_LIFT_SPRING));
        }),
    [enabled, x, y, startX, startY, lift, target, bounds, width, height, top, settle],
  );

  return { pan, x, y, lift };
}
