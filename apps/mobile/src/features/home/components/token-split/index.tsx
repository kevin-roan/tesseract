import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MaxFontSizeMultiplier } from "@/theme";

import { useSplitShades } from "../../hooks/use-split-shades";
import { formatTokens, splitCells, type TokenSplitPart } from "../../utils/tokens";
import createStyles from "./styles";
import { useFillReveal } from "./use-fill-reveal";

export type TokenSplitProps = {
  parts: readonly TokenSplitPart[];
};

/** Cell strip where each part claims its share of cells in its own grey, swept in from the left, over a legend. */
const TokenSplit = ({ parts }: TokenSplitProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cells = useMemo(() => splitCells(parts), [parts]);
  const shadeOf = useSplitShades();
  const reveal = useFillReveal(cells.join(","));

  return (
    <View style={styles.container}>
      <View
        style={styles.bar}
        onLayout={reveal.onLayout}
        accessibilityRole="image"
        accessibilityLabel={parts.map((part) => `${part.label} ${Math.round(part.fraction * 100)}%`).join(", ")}
      >
        <Animated.View style={[styles.clip, reveal.clipStyle]}>
          <View style={[styles.cells, { width: reveal.width }]}>
            {cells.map((part, index) => (
              <View key={index} style={[styles.cell, shadeOf(part)]} />
            ))}
          </View>
        </Animated.View>
      </View>
      <View style={styles.legend}>
        {parts.map((part, index) => (
          <View key={part.id} style={styles.item}>
            <View style={[styles.swatch, shadeOf(index)]} />
            <ThemedText
              variant="caption"
              color="textSecondary"
              numberOfLines={1}
              maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
              style={styles.label}
            >
              {part.label}
            </ThemedText>
            <ThemedText variant="caption" numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome} style={styles.value}>
              {formatTokens(part.value)}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
};

export default TokenSplit;
