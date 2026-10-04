import { useMemo } from "react";
import { ZoomIn } from "react-native-reanimated";

import { useLayoutMotion } from "@/hooks/use-layout-motion";
import { MotionEasing } from "@/lib/motion";
import { Durations } from "@/theme";

/** Pop-in, fade-out and slide-over transitions for chips joining or leaving a tray. */
export function useChipTransitions() {
  const motion = useLayoutMotion();

  return useMemo(
    () => ({
      entering: ZoomIn.duration(Durations.normal).easing(MotionEasing),
      exiting: motion.fadeOut,
      layout: motion.layout,
    }),
    [motion],
  );
}
