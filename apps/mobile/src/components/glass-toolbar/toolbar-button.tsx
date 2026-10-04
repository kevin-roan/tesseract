import { useMemo } from "react";

import PressableScale from "@/components/pressable-scale";
import type { HeaderAction } from "@/components/screen-header";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { ToneColors } from "@/lib/tone";
import { HitSlop, IconSize } from "@/theme";

import createStyles from "./styles";

export type GlassToolbarAction = HeaderAction & { selected?: boolean };

const ToolbarButton = ({ icon: IconComponent, label, onPress, disabled, tone, selected = false }: GlassToolbarAction) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const handlePress = useHapticPress(onPress);
  const color = tone ? theme.colors[ToneColors[tone].foreground] : theme.colors.text;

  return (
    <PressableScale
      depth="control"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected }}
      onPress={handlePress}
      disabled={disabled}
      hitSlop={HitSlop.sm}
      style={[styles.button, selected && styles.selected, disabled && styles.disabled]}
      pressedStyle={styles.pressed}
    >
      <IconComponent size={IconSize.md} color={color} weight={selected ? "fill" : "regular"} />
    </PressableScale>
  );
};

export default ToolbarButton;
