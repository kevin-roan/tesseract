import { useMemo } from "react";
import { Pressable } from "react-native";

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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected }}
      onPress={handlePress}
      disabled={disabled}
      hitSlop={HitSlop.sm}
      style={({ pressed }) => [styles.button, selected && styles.selected, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <IconComponent size={IconSize.md} color={color} weight={selected ? "fill" : "bold"} />
    </Pressable>
  );
};

export default ToolbarButton;
