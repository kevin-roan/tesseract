import { useMemo } from "react";
import { SlideInDown } from "react-native-reanimated";

import { MotionEasing } from "@/lib/motion";
import { Durations } from "@/theme";

/** Sheets rise from the bottom edge at a steady pace. */
export function useSheetEntrance() {
  return useMemo(() => SlideInDown.duration(Durations.slow).easing(MotionEasing), []);
}
