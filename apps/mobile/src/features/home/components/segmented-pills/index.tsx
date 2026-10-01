import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { Glass } from "@/components/glass";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type SegmentedOption<T> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

export type SegmentedPillsProps<T> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** Row of pills where the chosen one turns solid ink and the rest stay glass. */
const SegmentedPills = <T extends string | number>({ options, value, onChange }: SegmentedPillsProps<T>) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        const label = (
          <ThemedText variant="label" numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
            {option.label}
          </ThemedText>
        );
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            hitSlop={HitSlop.sm}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            {selected ? (
              <Surface tone="ink" style={styles.pill}>
                {label}
              </Surface>
            ) : (
              <Glass style={styles.pill}>{label}</Glass>
            )}
          </Pressable>
        );
      })}
    </View>
  );
};

export default SegmentedPills;
