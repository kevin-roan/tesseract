import { useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { SetupSegment } from "../../utils/content";
import createStyles from "./styles";

export type StepMeterProps = {
  segments: SetupSegment[];
};

const StepMeter = ({ segments }: StepMeterProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {segments.map((segment) => (
        <View key={segment.id} style={styles.segment}>
          <View style={[styles.bar, segment.active && styles.active]} />
          <ThemedText variant="caption" color={segment.active ? "text" : "textTertiary"} numberOfLines={1}>
            {segment.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
};

export default StepMeter;
