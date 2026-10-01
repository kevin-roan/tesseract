import { useMemo } from "react";
import { Pressable } from "react-native";
import type { Icon } from "phosphor-react-native";

import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize, type SurfaceTone } from "@/theme";

import createStyles from "./styles";

export type ActionCardProps = {
  icon: Icon;
  /** Short verb, one word where possible — "Create", "Share". */
  label: string;
  /** Card fill. Defaults to `neutral`; give the action a section leads with `yellow`. */
  tone?: SurfaceTone;
  onPress?: () => void;
};

/** Square quick-action tile: centred icon over a one-word label. */
const ActionCard = ({ icon: IconComponent, label, tone = "neutral", onPress }: ActionCardProps) => {
  const theme = useAppTheme(tone);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const card = (
    <Surface tone={tone} style={styles.card}>
      <IconComponent size={IconSize.lg} color={theme.colors.text} />
      <ThemedText variant="caption" color="textSecondary" style={styles.label} numberOfLines={1}>
        {label}
      </ThemedText>
    </Surface>
  );

  if (!onPress) return card;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {card}
    </Pressable>
  );
};

export default ActionCard;
