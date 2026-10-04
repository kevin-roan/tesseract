import { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";

import { SLIDE_PARALLAX } from "../utils/content";

function useParallax(progress: SharedValue<number>, position: number, width: number, factor: number) {
  return useAnimatedStyle(() => {
    const range = [position - 1, position, position + 1];
    const shift = width * factor;
    return {
      opacity: interpolate(progress.value, range, [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(progress.value, range, [shift, 0, -shift], Extrapolation.CLAMP) }],
    };
  });
}

export function useSlideParallax(progress: SharedValue<number>, position: number, width: number) {
  const hero = useParallax(progress, position, width, SLIDE_PARALLAX.hero);
  const copy = useParallax(progress, position, width, SLIDE_PARALLAX.copy);
  return { hero, copy };
}
