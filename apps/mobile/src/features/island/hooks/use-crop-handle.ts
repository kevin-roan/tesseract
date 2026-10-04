import { useAnimatedStyle, withTiming, type SharedValue } from "react-native-reanimated";

import { linearTiming } from "@/lib/motion";

import type { Corner } from "../types";
import { CROP_HANDLE_GRAB_SCALE } from "../utils/constants";

/** Scales a crop corner up while it is held so the grabbed handle reads as lifted. */
export function useCropHandle(grabbed: SharedValue<Corner | null>, corner: Corner) {
  return useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(grabbed.get() === corner ? CROP_HANDLE_GRAB_SCALE : 1, linearTiming()) }],
  }));
}
