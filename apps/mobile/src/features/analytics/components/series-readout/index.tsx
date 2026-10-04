import { useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type ReadoutItem = {
  key: string;
  label: string;
  color: string;
  value: string;
};

export type SeriesReadoutProps = {
  title: string;
  total?: string;
  items: ReadoutItem[];
  live?: boolean;
};

/**
 * Legend and inspection readout in one: series keys with their values for the whole range, or for the column the
 * reader is touching. Values lead, labels follow, text stays in text ink next to the color key.
 */
const SeriesReadout = ({ title, total, items, live = false }: SeriesReadoutProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.readout} accessibilityLiveRegion={live ? "polite" : "none"}>
      <View style={styles.head}>
        <ThemedText variant="caption" color="textTertiary" numberOfLines={1} style={styles.title}>
          {title}
        </ThemedText>
        {total ? (
          <ThemedText variant="h4" style={styles.value}>
            {total}
          </ThemedText>
        ) : null}
      </View>
      {items.length > 0 ? (
        <View style={styles.items}>
          {items.map((item) => (
            <View key={item.key} style={styles.item} accessible accessibilityLabel={`${item.label} ${item.value}`}>
              <View style={[styles.swatch, { backgroundColor: item.color }]} />
              <ThemedText variant="label" style={styles.value}>
                {item.value}
              </ThemedText>
              <ThemedText variant="caption" color="textTertiary">
                {item.label}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default SeriesReadout;
