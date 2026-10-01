import { useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { Kpi } from "../../utils/view-model";
import createStyles from "./styles";

export type KpiGridProps = {
  items: Kpi[];
  testID?: string;
};

const KpiGrid = ({ items, testID }: KpiGridProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.grid} testID={testID}>
      {items.map((item) => (
        <View
          key={item.id}
          style={styles.tile}
          accessible
          accessibilityLabel={`${item.label}, ${item.value}. ${item.caption}`}
          testID={testID ? `${testID}-${item.id}` : undefined}
        >
          <ThemedText variant="label" color="textSecondary" numberOfLines={1}>
            {item.label}
          </ThemedText>
          <ThemedText variant="h2" numberOfLines={1} adjustsFontSizeToFit>
            {item.value}
          </ThemedText>
          <ThemedText variant="caption" color="textTertiary" numberOfLines={2}>
            {item.caption}
          </ThemedText>
        </View>
      ))}
    </View>
  );
};

export default KpiGrid;
