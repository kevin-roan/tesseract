import { useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MaxFontSizeMultiplier } from "@/theme";

import MetricFigure from "../metric-figure";
import createStyles from "./styles";

export type GlassStatProps = {
  value: string;
  label: string;
};

/** Small hairline sub-card: a number over its caption, read once as "value label". */
const GlassStat = ({ value, label }: GlassStatProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card} accessible accessibilityLabel={`${value} ${label}`}>
      <MetricFigure value={value} size="metricSmall" accessibilityLabel={`${value} ${label}`} />
      <ThemedText
        variant="caption"
        color="textSecondary"
        numberOfLines={1}
        maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
      >
        {label}
      </ThemedText>
    </View>
  );
};

export default GlassStat;
