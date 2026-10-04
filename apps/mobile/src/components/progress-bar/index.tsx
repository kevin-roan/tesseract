import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import type { Tone } from "@/lib/tone";

import createStyles from "./styles";
import { useProgressFill } from "./use-progress-fill";

export type ProgressBarProps = {
  progress: number | null;
  tone?: Tone;
  label?: string;
};

const ProgressFill = ({ percent, style }: { percent: number; style: StyleProp<ViewStyle> }) => {
  const width = useProgressFill(percent);
  return <Animated.View style={[style, width]} />;
};

const ProgressBar = ({ progress, tone = "info", label }: ProgressBarProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, tone), [theme, tone]);
  const percent = progress === null ? null : Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={percent === null ? undefined : { min: 0, max: 100, now: percent }}
    >
      {percent === null ? null : <ProgressFill percent={percent} style={styles.fill} />}
    </View>
  );
};

export default ProgressBar;
