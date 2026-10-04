import { memo, useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { ControlHeight } from "@/theme";

import { dashCapacity, dashRows, dashSpan } from "../../utils/levels";
import { useWaveSpans } from "../../hooks/use-dash-height";
import DashColumn from "../dash-column";
import createStyles from "./styles";

export type LiveWaveformProps = {
  levels: number[];
  /** While live, columns glide to each new level in the active color; otherwise they rest muted. */
  live?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Microphone levels as columns of short rounded dashes that grow and shrink around the midline. */
const LiveWaveform = ({ levels, live = true, height = ControlHeight.sm, style }: LiveWaveformProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, height), [theme, height]);
  const dash = theme.spacing.xxs;
  const capacity = dashCapacity(height, dash, dash);
  const spans = useMemo(
    () => levels.map((level) => dashSpan(dashRows(level, capacity), dash, dash)),
    [levels, capacity, dash],
  );
  const wave = useWaveSpans(spans, live);

  return (
    <View
      style={[styles.wave, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {spans.map((_, index) => (
        <DashColumn key={index} wave={wave} index={index} capacity={capacity} color={live ? "voiceActive" : "textTertiary"} />
      ))}
    </View>
  );
};

export default memo(LiveWaveform);
