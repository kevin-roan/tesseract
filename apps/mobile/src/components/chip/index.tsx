import { useMemo } from "react";
import { Pressable } from "react-native";
import { CaretDownIcon, type Icon } from "phosphor-react-native";

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
  /** `ghost` drops the pill and adds a caret, for pickers that sit inside another surface. */
  variant?: "pill" | "ghost";
};

const Chip = ({ label, selected = false, icon: IconComponent, onPress, onLongPress, disabled, variant = "pill" }: ChipProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const ghost = variant === "ghost";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={label}
      hitSlop={HitSlop.sm}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, ghost && styles.ghost, pressed && styles.pressed, disabled && styles.disabled]}
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
        style={styles.label}
      >
        {label}
      </ThemedText>
      {ghost ? <CaretDownIcon size={IconSize.xs} color={theme.colors.textSecondary} weight="bold" /> : null}
    </Pressable>
  );
};

export default Chip;
