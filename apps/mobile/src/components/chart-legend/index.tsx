import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Svg, { Line } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { DashArrays, type ChartDash } from "@/components/time-series-chart/geometry";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, MaxFontSizeMultiplier } from "@/theme";

import createStyles, { SwatchSize } from "./styles";

export type ChartLegendItem = {
  id: string;
  label: string;
  color: string;
  /** Latest reading, e.g. "13%". */
  value?: string;
  dash?: ChartDash;
  active: boolean;
};

export type ChartLegendProps = {
  items: readonly ChartLegendItem[];
  onToggle: (id: string) => void;
};

/** Wrapping row of series chips; tapping one shows or hides its line. */
const ChartLegend = ({ items, onToggle }: ChartLegendProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="switch"
          accessibilityState={{ checked: item.active }}
          accessibilityLabel={[item.label, item.value].filter(Boolean).join(", ")}
          hitSlop={HitSlop.sm}
          onPress={() => onToggle(item.id)}
          style={[styles.chip, !item.active && styles.inactive]}
        >
          <Svg width={SwatchSize.width} height={SwatchSize.height}>
            <Line
              x1={1}
              x2={SwatchSize.width - 1}
              y1={SwatchSize.height / 2}
              y2={SwatchSize.height / 2}
              stroke={item.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={DashArrays[item.dash ?? "solid"]}
            />
          </Svg>
          <ThemedText
            variant="caption"
            color={item.active ? "textSecondary" : "textTertiary"}
            numberOfLines={1}
            maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
          >
            {item.label}
          </ThemedText>
          {item.value ? (
            <ThemedText
              variant="caption"
              color={item.active ? "text" : "textTertiary"}
              maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
              style={styles.value}
            >
              {item.value}
            </ThemedText>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
};

export default ChartLegend;
