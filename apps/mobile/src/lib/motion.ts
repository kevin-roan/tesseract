import { Easing, ReduceMotion, type WithTimingConfig } from "react-native-reanimated";

import { Durations } from "@/theme";

/** The one curve every animation in the app moves on: straight, no spring, no overshoot. */
export const MotionEasing = Easing.linear;

/** `withTiming` config on the shared linear curve. */
export function linearTiming(duration: number = Durations.normal): WithTimingConfig {
  return { duration, easing: MotionEasing, reduceMotion: ReduceMotion.System };
}
