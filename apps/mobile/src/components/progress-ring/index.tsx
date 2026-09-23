import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type ProgressRingProps = {
  /** Completion in the 0–1 range; values outside are clamped. */
  progress: number;
  /** Outer diameter in dp. */
  size?: number;
  thickness?: number;
  /** Colour of the filled arc. Defaults to the theme accent. */
  color?: string;
  /** Colour of the unfilled remainder. */
  trackColor?: string;
  /** Percentage label drawn inside the ring. Hidden when false. */
  showLabel?: boolean;
  labelColor?: string;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Thin percentage ring used on stat cards. The arc starts at 12 o'clock and
 * runs clockwise, which is why the SVG is rotated -90°.
 */
const ProgressRing = ({
  progress,
  size = 40,
  thickness = 3,
  color,
  trackColor,
  showLabel = true,
  labelColor,
}: ProgressRingProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(size), [size]);

  const value = clamp(progress);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? theme.colors.border}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color ?? theme.colors.accent}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value)}
          fill="none"
        />
      </Svg>
      {showLabel ? (
        <ThemedText
          variant="caption"
          color="textSecondary"
          style={labelColor ? { color: labelColor } : undefined}
        >
          {Math.round(value * 100)}%
        </ThemedText>
      ) : null}
    </View>
  );
};

export default ProgressRing;
