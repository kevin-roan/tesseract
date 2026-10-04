import { Easing, ReduceMotion, type WithTimingConfig } from "react-native-reanimated";

import { Durations } from "@/theme";

/** The one curve every animation in the app moves on: straight, no spring, no overshoot. */
export const MotionEasing = Easing.linear;

/**
 * `withTiming` config on the shared linear curve.
 * The default is resolved in the body, not as a default parameter: the worklets plugin
 * does not capture identifiers used in default parameters, so `Durations` would be missing on the UI thread.
 */
export function linearTiming(duration?: number): WithTimingConfig {
  "worklet";
  return { duration: duration ?? Durations.normal, easing: MotionEasing, reduceMotion: ReduceMotion.System };
}
