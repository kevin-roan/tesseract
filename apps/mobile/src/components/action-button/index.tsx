import { useMemo } from "react";
import { ActivityIndicator } from "react-native";
import type { Icon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { HitSlop, IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";
import { ActionButtonColors, ActionButtonIconWeight, type ActionButtonVariant } from "./variants";

export type { ActionButtonVariant } from "./variants";

export type ActionButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ActionButtonVariant;
  size?: "sm" | "md";
  icon?: Icon;
  loading?: boolean;
  disabled?: boolean;
  stretch?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  /** Light impact on press (native only). On by default. */
  haptics?: boolean;
};

const ActionButton = ({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon: IconComponent,
  loading = false,
  disabled = false,
  stretch = false,
  accessibilityLabel,
  testID,
  haptics = true,
}: ActionButtonProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, variant, size, stretch), [theme, variant, size, stretch]);
  const { foreground } = ActionButtonColors[variant];
  const inactive = disabled || loading;
  const handlePress = useHapticPress(onPress, haptics);

  return (
    <PressableScale
      depth="control"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={HitSlop.sm}
      onPress={handlePress}
      testID={testID}
      style={[styles.button, disabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors[foreground]} />
      ) : IconComponent ? (
        <IconComponent
          size={size === "sm" ? IconSize.sm : IconSize.md}
          color={theme.colors[foreground]}
          weight={ActionButtonIconWeight[theme.look]}
        />
      ) : null}
      <ThemedText
        variant={size === "sm" ? "label" : "button"}
        color={foreground}
        numberOfLines={1}
        maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
      >
        {label}
      </ThemedText>
    </PressableScale>
  );
};

export default ActionButton;
