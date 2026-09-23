import { useMemo } from "react";
import { Pressable } from "react-native";

import ActionCard, { type ActionCardProps } from "@/components/action-card";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type ActionTileProps = ActionCardProps & {
  disabled?: boolean;
  accessibilityHint?: string;
};

/**
 * An ActionCard that can also be unavailable. It stays focusable while
 * disabled so screen readers can still announce the hint explaining why.
 */
const ActionTile = ({ onPress, disabled = false, accessibilityHint, ...card }: ActionTileProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const inactive = disabled || !onPress;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={card.label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed, inactive && styles.disabled]}
    >
      <ActionCard {...card} />
    </Pressable>
  );
};

export default ActionTile;
