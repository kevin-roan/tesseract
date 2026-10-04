import { useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import PressableScale from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Durations, HitSlop, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Rendered in place of the chart when the reader asks for the table view. */
  table?: ReactNode;
  testID?: string;
};

const crossfade = FadeIn.duration(Durations.normal);

const ChartCard = ({ title, subtitle, children, table, testID }: ChartCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showTable, setShowTable] = useState(false);
  const tableShown = showTable && table !== undefined;

  return (
    <Surface style={styles.card} testID={testID}>
      <View style={styles.head}>
        <ThemedText
          variant="h4"
          accessibilityRole="header"
          numberOfLines={2}
          maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
        >
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText variant="bodySmall" color="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Animated.View key={tableShown ? "table" : "chart"} entering={table ? crossfade : undefined}>
        {tableShown ? table : children}
      </Animated.View>
      {table ? (
        <View style={styles.footer}>
          <PressableScale
            depth="control"
            accessibilityRole="button"
            accessibilityLabel={showTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
            hitSlop={HitSlop.md}
            onPress={() => setShowTable((value) => !value)}
            style={styles.toggle}
          >
            <ThemedText variant="label" maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
              {showTable ? "Show chart" : "Show table"}
            </ThemedText>
          </PressableScale>
        </View>
      ) : null}
    </Surface>
  );
};

export default ChartCard;
