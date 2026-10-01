import { useMemo } from "react";
import { View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import HeroOrb from "../hero-orb";
import type { OnboardingSlide as Slide } from "../../utils/content";
import createStyles from "./styles";

export type OnboardingSlideProps = {
  slide: Slide;
  position: number;
  progress: SharedValue<number>;
  width: number;
};

const OnboardingSlide = ({ slide, position, progress, width }: OnboardingSlideProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, width), [theme, width]);
  const range = [position - 1, position, position + 1];

  const hero = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(progress.value, range, [width * 0.4, 0, -width * 0.4], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, range, [0.7, 1, 0.7], Extrapolation.CLAMP) },
    ],
  }));

  const copy = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(progress.value, range, [width * 0.2, 0, -width * 0.2], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.page} testID={`onboarding-slide-${slide.id}`}>
      <Animated.View style={[styles.hero, hero]}>
        <HeroOrb icon={slide.icon} />
      </Animated.View>
      <Animated.View style={[styles.copy, copy]}>
        <ThemedText variant="overline" color="textSecondary" style={styles.centered}>
          {slide.eyebrow}
        </ThemedText>
        <ThemedText variant="h1" accessibilityRole="header" style={styles.centered}>
          {slide.title}
        </ThemedText>
        <ThemedText variant="bodyLarge" color="textSecondary" style={styles.centered}>
          {slide.message}
        </ThemedText>
      </Animated.View>
    </View>
  );
};

export default OnboardingSlide;
