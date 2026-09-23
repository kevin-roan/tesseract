import { useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { Tone } from "@/lib/tone";

import createStyles from "./styles";

export type ConnectionDotProps = {
  tone: Tone;
  label?: string;
};

const ConnectionDot = ({ tone, label }: ConnectionDotProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, tone), [theme, tone]);

  return (
    <View style={styles.row} accessibilityLabel={label}>
      <View style={styles.halo}>
        <View style={styles.dot} />
      </View>
      {label ? (
        <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
};

export default ConnectionDot;
