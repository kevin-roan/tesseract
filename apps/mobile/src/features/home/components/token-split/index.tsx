import { useMemo } from "react";
import { View } from "react-native";

import { Glass } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { formatTokens, type TokenSplitPart } from "../../utils/tokens";
import createStyles from "./styles";

export type TokenSplitProps = {
  parts: readonly TokenSplitPart[];
};

const TokenSplit = ({ parts }: TokenSplitProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const colorOf = (index: number) => theme.chart.categorical[index % theme.chart.categorical.length];

  return (
    <View style={styles.container}>
      <View
        style={styles.bar}
        accessibilityRole="image"
        accessibilityLabel={parts.map((part) => `${part.label} ${Math.round(part.fraction * 100)}%`).join(", ")}
      >
        {parts.map((part, index) =>
          part.fraction > 0 ? (
            <View key={part.id} style={[styles.segment, { flex: part.fraction, backgroundColor: colorOf(index) }]} />
          ) : null,
        )}
      </View>
      <View style={styles.legend}>
        {parts.map((part, index) => (
          <Glass key={part.id} style={styles.chip}>
            <View style={[styles.swatch, { backgroundColor: colorOf(index) }]} />
            <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
              {part.label}
            </ThemedText>
            <ThemedText variant="label" numberOfLines={1}>
              {formatTokens(part.value)}
            </ThemedText>
          </Glass>
        ))}
      </View>
    </View>
  );
};

export default TokenSplit;
