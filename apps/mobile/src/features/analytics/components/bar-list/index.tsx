import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { CaretRightIcon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import type { BarItem } from "../../types";
import createStyles from "./styles";

export type BarListProps = {
  items: BarItem[];
  color: string;
  testID?: string;
};

/** Ranked horizontal bars, longest first, each scaled against the largest value in the list. */
const BarList = ({ items, color, testID }: BarListProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const max = items.reduce((best, item) => Math.max(best, item.value), 0);

  return (
    <View testID={testID}>
      {items.map((item) => {
        const share = max > 0 ? item.value / max : 0;
        const content = (
          <>
            <View style={styles.top}>
              <View style={styles.titles}>
                <ThemedText variant="label" numberOfLines={1}>
                  {item.label}
                </ThemedText>
                {item.detail ? (
                  <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
                    {item.detail}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText variant="bodyStrong" style={styles.value}>
                {item.valueLabel}
              </ThemedText>
              {item.onPress ? (
                <CaretRightIcon size={IconSize.sm} color={theme.colors.textTertiary} />
              ) : null}
            </View>
            <View style={styles.track}>
              {share > 0 ? (
                <View style={[styles.bar, { flex: share, backgroundColor: color }]} />
              ) : null}
              <View style={{ flex: 1 - share }} />
            </View>
          </>
        );
        const label = `${item.label}, ${item.valueLabel}${item.detail ? `, ${item.detail}` : ""}`;
        return item.onPress ? (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={item.onPress}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            testID={testID ? `${testID}-${item.id}` : undefined}
          >
            {content}
          </Pressable>
        ) : (
          <View key={item.id} style={styles.row} accessible accessibilityLabel={label}>
            {content}
          </View>
        );
      })}
    </View>
  );
};

export default BarList;
