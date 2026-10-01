import { useCallback, useState } from "react";
import { useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useAnimatedRef, useAnimatedScrollHandler, useSharedValue, type SharedValue } from "react-native-reanimated";
import type Animated from "react-native-reanimated";

export type OnboardingPager = {
  ref: ReturnType<typeof useAnimatedRef<Animated.ScrollView>>;
  width: number;
  index: number;
  isLast: boolean;
  progress: SharedValue<number>;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  onSettle: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  next: () => boolean;
};

export function useOnboardingPager(count: number): OnboardingPager {
  const { width } = useWindowDimensions();
  const ref = useAnimatedRef<Animated.ScrollView>();
  const progress = useSharedValue(0);
  const [index, setIndex] = useState(0);

  const onScroll = useAnimatedScrollHandler(
    (event) => {
      progress.value = width > 0 ? event.contentOffset.x / width : 0;
    },
    [width],
  );

  const onSettle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width > 0) setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  const next = useCallback(() => {
    if (index >= count - 1) return false;
    const target = index + 1;
    ref.current?.scrollTo({ x: target * width, animated: true });
    setIndex(target);
    return true;
  }, [count, index, ref, width]);

  return { ref, width, index, isLast: index >= count - 1, progress, onScroll, onSettle, next };
}
