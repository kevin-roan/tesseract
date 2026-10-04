import { useMemo } from "react";
import { ZoomIn } from "react-native-reanimated";

import { useLayoutMotion } from "@/hooks/use-layout-motion";
import { MotionEasing } from "@/lib/motion";
import { Durations } from "@/theme";

import { ISLAND_OPEN_SCALE } from "../utils/constants";

/** Linear layout and enter/exit transitions shared by the island capsule, card and their rows. */
export function useIslandMotion() {
  const motion = useLayoutMotion();

  return useMemo(
    () => ({
      ...motion,
      open: ZoomIn.duration(Durations.normal)
        .easing(MotionEasing)
        .withInitialValues({ transform: [{ scale: ISLAND_OPEN_SCALE }] }),
    }),
    [motion],
  );
}
