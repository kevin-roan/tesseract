import { useMemo } from "react";
import { View } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import type { Tone } from "@/lib/tone";

import createStyles from "./styles";

export type ProgressBarProps = {
  progress: number | null;
  tone?: Tone;
  label?: string;
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
      {percent === null ? null : <View style={[styles.fill, { width: `${percent}%` }]} />}
    </View>
  );
};

export default ProgressBar;
