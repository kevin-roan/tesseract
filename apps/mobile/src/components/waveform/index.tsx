import { memo, useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import type { ThemeColor } from "@/theme";

import createStyles from "./styles";

export type WaveformProps = {
  levels: number[];
  progress?: number;
  activeColor?: ThemeColor;
  inactiveColor?: ThemeColor;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

const Waveform = ({
  levels,
  progress = 1,
  activeColor = "accentStrong",
  inactiveColor = "borderStrong",
  height,
  style,
}: WaveformProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, height), [theme, height]);
  const played = Math.round(progress * levels.length);

  return (
    <View style={[styles.wave, style]} accessible={false} pointerEvents="none">
      {levels.map((level, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            {
              height: `${Math.round(level * 100)}%`,
              backgroundColor: theme.colors[index < played ? activeColor : inactiveColor],
            },
          ]}
        />
      ))}
    </View>
  );
};

export default memo(Waveform);
