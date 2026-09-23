import { useMemo } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import type { Icon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";
import { ActionButtonColors, type ActionButtonVariant } from "./variants";

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
}: ActionButtonProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, variant, size, stretch), [theme, variant, size, stretch]);
  const { foreground } = ActionButtonColors[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      hitSlop={HitSlop.sm}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors[foreground]} />
      ) : IconComponent ? (
        <IconComponent size={size === "sm" ? IconSize.sm : IconSize.md} color={theme.colors[foreground]} weight="bold" />
      ) : null}
      <ThemedText
        variant={size === "sm" ? "label" : "button"}
        color={foreground}
        numberOfLines={1}
        maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
};

export default ActionButton;
