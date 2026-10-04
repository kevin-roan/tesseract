import { useMemo } from "react";
import { View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MaxFontSizeMultiplier } from "@/theme";

import { usePageCounter } from "../../hooks/use-page-counter";
import { formatPageCount } from "../../utils/content";
import createStyles from "./styles";

export type PageDotsProps = {
  count: number;
  progress: SharedValue<number>;
};

const PageDots = ({ count, progress }: PageDotsProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const counter = usePageCounter(progress, count);

  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={formatPageCount(count)}>
      <ThemedText variant="caption" color="textSecondary" maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome} style={styles.counter}>
        {counter}
      </ThemedText>
      <View style={styles.track}>
        {Array.from({ length: count }, (_, position) => (
          <Segment key={position} position={position} progress={progress} styles={styles} />
        ))}
      </View>
    </View>
  );
};

type SegmentProps = {
  position: number;
  progress: SharedValue<number>;
  styles: ReturnType<typeof createStyles>;
};

const Segment = ({ position, progress, styles }: SegmentProps) => {
  const animated = useAnimatedStyle(() => ({
    transform: [{ scaleX: interpolate(progress.value, [position - 1, position], [0, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.fill, animated]} />
    </View>
  );
};

export default PageDots;
