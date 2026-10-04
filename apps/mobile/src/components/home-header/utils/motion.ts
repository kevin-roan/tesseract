import { ZoomIn } from "react-native-reanimated";

import { MotionEasing } from "@/lib/motion";
import { Durations } from "@/theme";

/** The unread badge fades and scales in when a count first appears. */
export const badgeEntering = ZoomIn.duration(Durations.normal).easing(MotionEasing);
