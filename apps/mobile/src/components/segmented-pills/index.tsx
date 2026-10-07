import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";
import { useSegmentIndicator } from "./use-segment-indicator";

export type SegmentedOption<T> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

export type SegmentedPillsProps<T> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Scroll sideways instead of squeezing when the segments outgrow the width. */
  scrollable?: boolean;
  label?: string;
};

/** Soft strip of segments; a lit indicator springs under the chosen one. */
const SegmentedPills = <T extends string | number>({
  options,
  value,
  onChange,
  scrollable = false,
  label,
}: SegmentedPillsProps<T>) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const indicator = useSegmentIndicator(options.findIndex((option) => option.value === value));

  const strip = (
    <View style={[styles.row, scrollable && styles.rowFill]} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {indicator.ready ? <Animated.View pointerEvents="none" style={[styles.indicator, indicator.style]} /> : null}
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            hitSlop={HitSlop.sm}
            onPress={() => onChange(option.value)}
            onLayout={indicator.onLayout(index)}
            style={[styles.segment, selected && !indicator.ready && styles.selected]}
          >
            <ThemedText
              variant="caption"
              color={selected ? "text" : "textSecondary"}
              numberOfLines={1}
              maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
              style={selected ? styles.labelSelected : null}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );

  if (!scrollable) return strip;

  return (
    <ScrollView
      horizontal
      style={styles.scroller}
      contentContainerStyle={styles.scrollContent}
      showsHorizontalScrollIndicator={false}
    >
      {strip}
    </ScrollView>
  );
};

export default SegmentedPills;
