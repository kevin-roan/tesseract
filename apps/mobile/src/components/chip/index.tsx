import { useMemo } from "react";
import { CaretDownIcon, type Icon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, IconSize, MaxFontSizeMultiplier } from "@/theme";

import { useChipSelection } from "./hooks/use-chip-selection";
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
  const selection = useChipSelection(theme, selected, !ghost);

  return (
    <PressableScale
      depth="control"
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={label}
      hitSlop={HitSlop.sm}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.chip, ghost ? styles.ghost : selection, disabled && styles.disabled]}
    >
      {IconComponent ? (
        <IconComponent
          size={IconSize.sm}
          color={selected ? theme.colors.text : theme.colors.textSecondary}
          weight={selected ? "fill" : theme.look === "graphite" ? "light" : "regular"}
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
      {ghost ? <CaretDownIcon size={IconSize.xs} color={theme.colors.textSecondary} weight="regular" /> : null}
    </PressableScale>
  );
};

export default Chip;
