import { useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { TextVariant } from "@/theme";

import createStyles from "./styles";

export type MetricFigureProps = {
  value: string;
  unit?: string;
  size?: Extract<TextVariant, "metric" | "metricSmall">;
  accessibilityLabel?: string;
};

/** A big confident number with its unit set small and grey on the same baseline. */
const MetricFigure = ({ value, unit, size = "metric", accessibilityLabel }: MetricFigureProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row} accessible accessibilityLabel={accessibilityLabel ?? [value, unit].filter(Boolean).join(" ")}>
      <ThemedText variant={size} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      {unit ? (
        <ThemedText variant={size === "metric" ? "body" : "caption"} color="textTertiary" numberOfLines={1}>
          {unit}
        </ThemedText>
      ) : null}
    </View>
  );
};

export default MetricFigure;
