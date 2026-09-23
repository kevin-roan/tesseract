import { useMemo } from "react";
import { Pressable, View } from "react-native";
import type { Icon } from "phosphor-react-native";

import { GlassSurface } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import createStyles from "./styles";

export type ListCardProps = {
  icon: Icon;
  title: string;
  /** Optional second line under the title. */
  subtitle?: string;
  /** Trailing figure, pre-formatted — "2,079". */
  value?: string;
  /** Small caption under the trailing figure, e.g. "Responses". */
  valueLabel?: string;
  onPress?: () => void;
};

/**
 * Full-width list row on a glass card: icon badge, title block, and an
 * optional trailing figure with its own caption.
 */
const ListCard = ({
  icon: IconComponent,
  title,
  subtitle,
  value,
  valueLabel,
  onPress,
}: ListCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const card = (
    <GlassSurface style={styles.card}>
      <View style={styles.iconBadge}>
        <IconComponent
          size={IconSize.md}
          color={theme.colors.text}
          weight="duotone"
        />
      </View>

      <View style={styles.body}>
        <ThemedText variant="bodyStrong" numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      {value ? (
        <View style={styles.trailing}>
          <ThemedText variant="h4" numberOfLines={1}>
            {value}
          </ThemedText>
          {valueLabel ? (
            <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
              {valueLabel}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </GlassSurface>
  );

  if (!onPress) return card;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value, valueLabel]
        .filter(Boolean)
        .join(", ")}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {card}
    </Pressable>
  );
};

export default ListCard;
