import { useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors, type Tone } from "@/lib/tone";

import createStyles from "./styles";

export type KeyValueRowProps = {
  label: string;
  value: string;
  monospace?: boolean;
  tone?: Tone;
};

const KeyValueRow = ({ label, value, monospace = false, tone }: KeyValueRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row} accessibilityLabel={`${label}: ${value}`}>
      <ThemedText variant="bodySmall" color="textSecondary" style={styles.label} numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText
        variant={monospace ? "code" : "bodySmall"}
        color={tone ? ToneColors[tone].foreground : "text"}
        style={styles.value}
        numberOfLines={2}
        selectable
      >
        {value}
      </ThemedText>
    </View>
  );
};

export default KeyValueRow;
