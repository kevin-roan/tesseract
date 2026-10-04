import { useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type MetricReadoutProps = {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  trend?: "up" | "down";
};

const MetricReadout = ({ label, value, unit, delta, trend = "up" }: MetricReadoutProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.readout}>
      <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <View style={styles.figure}>
        <ThemedText
          variant="metricSmall"
          numberOfLines={1}
          maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
          style={styles.value}
        >
          {value}
        </ThemedText>
        {unit ? (
          <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
            {unit}
          </ThemedText>
        ) : null}
      </View>
      {delta ? (
        <ThemedText variant="caption" color={trend === "down" ? "danger" : "success"} numberOfLines={1}>
          {delta}
        </ThemedText>
      ) : null}
    </View>
  );
};

export default MetricReadout;
