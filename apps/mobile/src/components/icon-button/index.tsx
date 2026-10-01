import { useMemo } from "react";
import type { Icon } from "phosphor-react-native";

import { SurfaceButton } from "@/components/surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { ToneColors, type Tone } from "@/lib/tone";
import { HitSlop, IconSize } from "@/theme";

import createStyles from "./styles";

export type IconButtonProps = {
  icon: Icon;
  label: string;
  hint?: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: Tone;
  /** `md` is the 40pt toolbar size; its hit area is extended back past the touch minimum. */
  size?: "md" | "lg";
  /** Light impact on press (native only). On by default. */
  haptics?: boolean;
  testID?: string;
};

const IconButton = ({ icon: IconComponent, label, hint, onPress, disabled, tone, size = "lg", haptics = true, testID }: IconButtonProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);
  const handlePress = useHapticPress(onPress, haptics);
  const color = tone ? theme.colors[ToneColors[tone].foreground] : theme.colors.text;

  return (
    <SurfaceButton
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={handlePress}
      disabled={disabled}
      hitSlop={size === "md" ? HitSlop.sm : undefined}
      style={styles.button}
      testID={testID}
    >
      <IconComponent size={IconSize.md} color={color} weight="bold" />
    </SurfaceButton>
  );
};

export default IconButton;
