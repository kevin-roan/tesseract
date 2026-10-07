import { useMemo } from "react";
import type { Icon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { SurfaceButton } from "@/components/surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { ToneColors, type Tone } from "@/lib/tone";
import { HitSlop, IconSize } from "@/theme";

import createStyles from "./styles";

export { squareButtonLook } from "./styles";

export type IconButtonProps = {
  icon: Icon;
  label: string;
  hint?: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: Tone;
  filled?: boolean;
  /** No fill or rim until pressed, for icons that sit on a card. */
  bare?: boolean;
  /** `md` is the 40pt toolbar size; its hit area is extended back past the touch minimum. */
  size?: "md" | "lg";
  /** Light impact on press (native only). On by default. */
  haptics?: boolean;
  testID?: string;
};

const IconButton = ({ icon: IconComponent, label, hint, onPress, disabled, tone, filled = false, bare = false, size = "lg", haptics = true, testID }: IconButtonProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);
  const handlePress = useHapticPress(onPress, haptics);
  const color = tone ? theme.colors[ToneColors[tone].foreground] : theme.colors.text;
  const hitSlop = size === "md" ? HitSlop.sm : undefined;
  const icon = <IconComponent size={IconSize.md} color={color} weight={filled ? "fill" : "regular"} />;

  if (theme.look === "graphite" || bare) {
    return (
      <PressableScale
        depth="control"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ disabled: !!disabled, selected: filled }}
        disabled={disabled}
        hitSlop={hitSlop}
        onPress={handlePress}
        testID={testID}
        style={[bare ? styles.bare : styles.square, disabled && styles.disabled]}
        pressedStyle={styles.pressed}
      >
        {icon}
      </PressableScale>
    );
  }

  return (
    <SurfaceButton
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={handlePress}
      disabled={disabled}
      hitSlop={hitSlop}
      style={styles.button}
      testID={testID}
    >
      {icon}
    </SurfaceButton>
  );
};

export default IconButton;
