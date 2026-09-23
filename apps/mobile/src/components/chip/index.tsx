import { useMemo } from "react";
import { Pressable } from "react-native";
import type { Icon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type ChipProps = {
  label: string;
  selected?: boolean;
  icon?: Icon;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
};

const Chip = ({ label, selected = false, icon: IconComponent, onPress, onLongPress, disabled }: ChipProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={label}
      hitSlop={HitSlop.sm}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      {IconComponent ? (
        <IconComponent
          size={IconSize.sm}
          color={selected ? theme.colors.text : theme.colors.textSecondary}
          weight={selected ? "fill" : "regular"}
        />
      ) : null}
      <ThemedText
        variant="label"
        color={selected ? "text" : "textSecondary"}
        numberOfLines={1}
        maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
};

export default Chip;
