import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";

import { useGrowIn } from "../../hooks/use-grow-in";
import type { ChartSeries } from "../../types";
import SeriesReadout from "../series-readout";
import createStyles from "./styles";

export type TokenMixBarProps = {
  title: string;
  series: ChartSeries[];
  values: number[];
  formatValue: (value: number) => string;
  testID?: string;
};

/** One 100% stacked bar: how a total splits across the series. */
const TokenMixBar = ({ title, series, values, formatValue, testID }: TokenMixBarProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const total = values.reduce((sum, value) => sum + value, 0);
  const grow = useGrowIn("x");

  return (
    <View style={styles.mix} testID={testID}>
      <Animated.View
        style={[styles.bar, grow]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {total > 0 ? (
          series.map((item, index) =>
            values[index] > 0 ? (
              <View key={item.key} style={[styles.segment, { flex: values[index] / total, backgroundColor: item.color }]} />
            ) : null,
          )
        ) : (
          <View style={[styles.segment, styles.empty]} />
        )}
      </Animated.View>
      <SeriesReadout
        title={title}
        total={formatValue(total)}
        items={series.map((item, index) => ({
          key: item.key,
          label: item.label,
          color: item.color,
          value: formatValue(values[index] ?? 0),
        }))}
      />
    </View>
  );
};

export default TokenMixBar;
