import { useMemo } from "react";
import { Pressable, View } from "react-native";

import type { ActionCardProps } from "@/components/action-card";
import { Glass } from "@/components/glass";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type ActionTileProps = ActionCardProps & {
  disabled?: boolean;
  accessibilityHint?: string;
};

/**
 * Quick action: a round bubble holding the icon over a label that wraps
 * instead of truncating. Neutral tiles are frosted glass; any other tone
 * fills the bubble, so the lead action can be the solid `ink` accent. It stays
 * focusable while disabled so screen readers can still announce the hint.
 */
const ActionTile = ({
  icon: IconComponent,
  label,
  tone = "neutral",
  onPress,
  disabled = false,
  accessibilityHint,
}: ActionTileProps) => {
  const theme = useAppTheme();
  const ink = useAppTheme(tone);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const inactive = disabled || !onPress;
  const icon = <IconComponent size={IconSize.lg} color={ink.colors.text} weight="bold" />;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed, inactive && styles.disabled]}
    >
      <View style={styles.bubbleSlot}>
        {tone === "neutral" ? (
          <Glass style={styles.bubble}>{icon}</Glass>
        ) : (
          <Surface tone={tone} style={styles.bubble}>
            {icon}
          </Surface>
        )}
      </View>
      <ThemedText
        variant="label"
        style={styles.label}
        numberOfLines={2}
        maxFontSizeMultiplier={MaxFontSizeMultiplier.heading}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
};

export default ActionTile;
