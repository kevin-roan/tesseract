import { View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import ActionButton from "@/components/action-button";
import CellMatrix from "@/components/cell-matrix";
import ScreenScaffold from "@/components/screen-scaffold";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import OnboardingSlide from "@/features/onboarding/components/onboarding-slide";
import PageDots from "@/features/onboarding/components/page-dots";
import { useOnboardingStyles } from "@/features/onboarding/hooks/use-onboarding-styles";
import { useWelcomeScreen } from "@/features/onboarding/hooks/use-welcome-screen";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Durations } from "@/theme";

export default function WelcomeScreen() {
  const { slides, labels, brandMark, pager, advance, skip, ctaLabel } = useWelcomeScreen();
  const { ref, onScroll, onSettle, progress, width, index, isLast } = pager;
  const styles = useOnboardingStyles();
  const theme = useAppTheme();

  return (
    <ScreenScaffold
      scroll={false}
      header={
        <Animated.View entering={FadeIn.duration(Durations.slow)} style={styles.topBar}>
          <View style={styles.brand}>
            <CellMatrix levels={brandMark.levels} live={brandMark.live} cellSize={theme.spacing.sm} />
            <ThemedText variant="h4">{labels.brand}</ThemedText>
          </View>
          {isLast ? null : <TagChip label={labels.skip} size="md" onPress={skip} testID="onboarding-skip" />}
        </Animated.View>
      }
      footer={
        <Animated.View entering={FadeInDown.delay(Durations.normal).duration(Durations.slow)} style={styles.footer}>
          <PageDots count={slides.length} progress={progress} />
          <ActionButton label={ctaLabel} onPress={advance} stretch testID="onboarding-next" />
        </Animated.View>
      }
    >
      <View style={styles.fill} testID="onboarding-welcome">
        <Animated.ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={onSettle}
        >
          {slides.map((slide, position) => (
            <OnboardingSlide
              key={slide.id}
              slide={slide}
              position={position}
              progress={progress}
              width={width}
              active={position === index}
            />
          ))}
        </Animated.ScrollView>
      </View>
    </ScreenScaffold>
  );
}
