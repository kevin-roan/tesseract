import { useMemo } from "react";
import { Pressable, View } from "react-native";
import type { Icon } from "phosphor-react-native";

import { GlassSurface } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import createStyles from "./styles";

export type ActionCardProps = {
  icon: Icon;
  /** Short verb, one word where possible — "Create", "Share". */
  label: string;
  /** Accent-filled treatment for the primary action. One per row, at most. */
  featured?: boolean;
  onPress?: () => void;
};

/**
 * Square quick-action tile: centred icon over a one-word label. Glass by
 * default, accent-filled for the action a section wants to lead with.
 */
const ActionCard = ({
  icon: IconComponent,
  label,
  featured = false,
  onPress,
}: ActionCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, featured), [theme, featured]);

  const content = (
    <>
      <IconComponent
        size={IconSize.lg}
        color={featured ? theme.colors.textOnAccent : theme.colors.text}
      />
      <ThemedText
        variant="caption"
        color={featured ? "textOnAccent" : "textSecondary"}
        style={styles.label}
        numberOfLines={1}
      >
        {label}
      </ThemedText>
    </>
  );

  const card = featured ? (
    <View style={styles.card}>{content}</View>
  ) : (
    <GlassSurface style={styles.card}>{content}</GlassSurface>
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
