import { useMemo } from "react";
import { View } from "react-native";

import type { ActionCardProps } from "@/components/action-card";
import PressableScale from "@/components/pressable-scale";
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
 * Quick action: a dark hairline tile holding the icon over a label that wraps
 * instead of truncating. Any tone other than neutral fills the tile with that
 * surface, so the lead action can be the `ink` accent. It stays focusable
 * while disabled so screen readers can still announce the hint.
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
  const icon = <IconComponent size={IconSize.lg} color={ink.colors.text} weight={theme.look === "graphite" ? "light" : "regular"} />;

  return (
    <PressableScale
      depth="control"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={[styles.tile, inactive && styles.disabled]}
    >
      <View style={styles.bubbleSlot}>
        {tone === "neutral" ? (
          <View style={[styles.bubble, styles.plain]}>{icon}</View>
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
    </PressableScale>
  );
};

export default ActionTile;
