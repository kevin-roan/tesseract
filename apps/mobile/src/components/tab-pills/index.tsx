import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, MaxFontSizeMultiplier, type ThemeColor } from "@/theme";

import createStyles from "./styles";

export type TabPillOption<T> = {
  value: T;
  label: string;
  /** Trails the label, e.g. a count. */
  badge?: string;
  badgeColor?: ThemeColor;
};

export type TabPillsProps<T> = {
  options: readonly TabPillOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Bare text tabs; the chosen one sits on a soft pill. */
const TabPills = <T extends string>({ options, value, onChange }: TabPillsProps<T>) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={[option.label, option.badge].filter(Boolean).join(" ")}
            hitSlop={HitSlop.sm}
            onPress={() => onChange(option.value)}
            style={[styles.tab, selected && styles.selected]}
          >
            <ThemedText
              variant="label"
              color={selected ? "text" : "textSecondary"}
              numberOfLines={1}
              maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
            >
              {option.label}
            </ThemedText>
            {option.badge ? (
              <ThemedText
                variant="label"
                color={option.badgeColor ?? "textTertiary"}
                maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
                style={styles.badge}
              >
                {option.badge}
              </ThemedText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
};

export default TabPills;
