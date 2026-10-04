import { memo, useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { ControlHeight, type ThemeColor } from "@/theme";

import createStyles from "./styles";
import { dashCapacity, dashCount } from "./utils/dashes";

export type WaveformProps = {
  levels: number[];
  progress?: number;
  activeColor?: ThemeColor;
  inactiveColor?: ThemeColor;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Levels drawn as columns of short rounded dashes centred on the midline; played columns take the active color. */
const Waveform = ({
  levels,
  progress = 1,
  activeColor = "accentStrong",
  inactiveColor = "borderStrong",
  height = ControlHeight.sm,
  style,
}: WaveformProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, height), [theme, height]);
  const capacity = dashCapacity(height, theme.spacing.xxs, theme.spacing.xxs);
  const played = Math.round(progress * levels.length);

  return (
    <View
      style={[styles.wave, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {levels.map((level, index) => {
        const color = { backgroundColor: theme.colors[index < played ? activeColor : inactiveColor] };
        return (
          <View key={index} style={styles.column}>
            {Array.from({ length: dashCount(level, capacity) }, (_, row) => (
              <View key={row} style={[styles.dash, color]} />
            ))}
          </View>
        );
      })}
    </View>
  );
};

export default memo(Waveform);
