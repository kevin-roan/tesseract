import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { clampProgress, percentLabel } from "@/lib/progress";
import { MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";
import { useRingSweep } from "./use-ring-sweep";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type ProgressRingProps = {
  /** Completion in the 0–1 range; values outside are clamped. */
  progress: number;
  /** Outer diameter in dp. */
  size?: number;
  thickness?: number;
  /** Colour of the filled arc. Defaults to `accentStrong`, which holds 3:1 on light surfaces. */
  color?: string;
  /** Colour of the unfilled remainder. */
  trackColor?: string;
  /** Percentage label drawn inside the ring. Hidden when false. */
  showLabel?: boolean;
  labelColor?: string;
};

/**
 * Percentage ring. The arc starts at 12 o'clock and runs clockwise, which is
 * why the SVG is rotated -90°. The label is sized from the inner diameter so
 * "100%" always fits inside the stroke.
 */
const ProgressRing = ({
  progress,
  size = 56,
  thickness = 5,
  color,
  trackColor,
  showLabel = true,
  labelColor,
}: ProgressRingProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(size, thickness), [size, thickness]);

  const value = clampProgress(progress);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const sweep = useRingSweep(value, circumference);

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? theme.colors.backgroundSelected}
          strokeWidth={thickness}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? theme.colors.accentStrong}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={sweep}
          fill="none"
        />
      </Svg>
      {showLabel ? (
        <ThemedText
          variant="label"
          color="textSecondary"
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
          style={[styles.label, labelColor ? { color: labelColor } : undefined]}
        >
          {percentLabel(value)}
        </ThemedText>
      ) : null}
    </View>
  );
};

export default ProgressRing;
