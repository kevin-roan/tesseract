import { memo, useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useChartMotion } from "@/hooks/use-chart-motion";
import { useScreenActive } from "@/hooks/use-screen-active";
import { ChartMotion } from "@/theme";

import createStyles, { BAR_GAP, BAR_WIDTH } from "./styles";

export type BarStripProps = {
  values: readonly number[];
  emphasis?: number;
  stream?: boolean;
  active?: boolean;
  period?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

const BarStrip = ({
  values,
  emphasis = 0,
  stream = false,
  active = true,
  period = ChartMotion.stream,
  height,
  style,
}: BarStripProps) => {
  const theme = useAppTheme();
  const screenActive = useScreenActive();
  const styles = useMemo(() => createStyles(theme, height), [theme, height]);
  const { reveal, cycle } = useChartMotion(active && screenActive, period, stream);
  const span = values.length * (BAR_WIDTH + BAR_GAP);
  const copies = stream && span > 0 ? Math.ceil(theme.width / span) + 1 : 1;
  const bars = useMemo(() => Array.from({ length: copies }, () => values).flat(), [copies, values]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: -cycle.value * span }, { scaleY: reveal.value }],
  }));

  return (
    <View style={[styles.strip, style]} accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none">
      <Animated.View style={[styles.track, motion]}>
        {bars.map((value, index) => (
          <View
            key={index}
            style={[styles.bar, value >= emphasis ? styles.strong : styles.quiet, { height: `${Math.round(value * 100)}%` }]}
          />
        ))}
      </Animated.View>
    </View>
  );
};

export default memo(BarStrip);
