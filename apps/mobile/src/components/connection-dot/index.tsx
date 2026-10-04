import { useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors, type Tone } from "@/lib/tone";

import createStyles from "./styles";

export type ConnectionDotProps = {
  tone: Tone;
  label?: string;
  /** `chip` sets the dot and label on a tinted pill, for status beside a title. */
  variant?: "plain" | "chip";
};

const ConnectionDot = ({ tone, label, variant = "plain" }: ConnectionDotProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, tone), [theme, tone]);
  const chip = variant === "chip";
  const { foreground } = ToneColors[tone];

  return (
    <View style={[styles.row, chip && styles.chip]} accessible={!!label} accessibilityLabel={label}>
      <View style={[styles.halo, chip && styles.bare]}>
        <View style={styles.dot} />
      </View>
      {label ? (
        <ThemedText variant="caption" color={chip ? foreground : "textSecondary"} numberOfLines={1}>
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
};

export default ConnectionDot;
