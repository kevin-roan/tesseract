import { useMemo } from "react";
import { View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles, { DOT_SIZE } from "./styles";

export type PageDotsProps = {
  count: number;
  progress: SharedValue<number>;
};

const PageDots = ({ count, progress }: PageDotsProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={`${count} pages`}>
      {Array.from({ length: count }, (_, position) => (
        <Dot key={position} position={position} progress={progress} style={styles.dot} />
      ))}
    </View>
  );
};

type DotProps = {
  position: number;
  progress: SharedValue<number>;
  style: ReturnType<typeof createStyles>["dot"];
};

const Dot = ({ position, progress, style }: DotProps) => {
  const animated = useAnimatedStyle(() => {
    const range = [position - 1, position, position + 1];
    return {
      width: interpolate(progress.value, range, [DOT_SIZE, DOT_SIZE * 3, DOT_SIZE], Extrapolation.CLAMP),
      opacity: interpolate(progress.value, range, [0.35, 1, 0.35], Extrapolation.CLAMP),
    };
  });

  return <Animated.View style={[style, animated]} />;
};

export default PageDots;
