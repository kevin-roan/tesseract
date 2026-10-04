import { ZoomIn } from "react-native-reanimated";

import { MotionEasing } from "@/lib/motion";
import { Durations } from "@/theme";

/** The selection check scales in when a row becomes selected. */
export const checkEntering = ZoomIn.duration(Durations.normal).easing(MotionEasing);
