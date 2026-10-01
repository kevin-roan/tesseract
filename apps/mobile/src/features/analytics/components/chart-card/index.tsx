import { useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop } from "@/theme";

import createStyles from "./styles";

export type ChartCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Rendered in place of the chart when the reader asks for the table view. */
  table?: ReactNode;
  testID?: string;
};

const ChartCard = ({ title, subtitle, children, table, testID }: ChartCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showTable, setShowTable] = useState(false);

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.head}>
        <ThemedText variant="h4" accessibilityRole="header">
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText variant="caption" color="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {showTable && table ? table : children}
      {table ? (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
            hitSlop={HitSlop.md}
            onPress={() => setShowTable((value) => !value)}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
          >
            <ThemedText variant="label" color="textSecondary">
              {showTable ? "Show chart" : "Show table"}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

export default ChartCard;
