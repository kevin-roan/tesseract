import { useMemo } from "react";
import { View } from "react-native";
import Animated, { type SharedValue } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MaxFontSizeMultiplier } from "@/theme";

import { useSlideCopyLayout } from "../../hooks/use-slide-copy-layout";
import { useSlideParallax } from "../../hooks/use-slide-parallax";
import type { OnboardingSlide as Slide } from "../../utils/content";
import SlidePanel from "../slide-panel";
import createStyles from "./styles";

export type OnboardingSlideProps = {
  slide: Slide;
  position: number;
  progress: SharedValue<number>;
  width: number;
  active?: boolean;
};

const OnboardingSlide = ({ slide, position, progress, width, active = true }: OnboardingSlideProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, width), [theme, width]);
  const { hero, copy } = useSlideParallax(progress, position, width);
  const variants = useSlideCopyLayout();

  return (
    <View
      style={styles.page}
      testID={`onboarding-slide-${slide.id}`}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      <View style={styles.column}>
        <Animated.View style={hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SlidePanel panel={slide.panel} icon={slide.icon} active={active} />
        </Animated.View>
        <Animated.View style={[styles.copy, copy]}>
          <ThemedText variant="overline" color="textSecondary" maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
            {slide.eyebrow}
          </ThemedText>
          <ThemedText
            variant={variants.title}
            accessibilityRole="header"
            maxFontSizeMultiplier={MaxFontSizeMultiplier.fixed}
          >
            {slide.title}
          </ThemedText>
          <ThemedText variant={variants.message} color="textSecondary" maxFontSizeMultiplier={MaxFontSizeMultiplier.fixed}>
            {slide.message}
          </ThemedText>
        </Animated.View>
      </View>
    </View>
  );
};

export default OnboardingSlide;
