import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { CaretRightIcon, type Icon } from "phosphor-react-native";

import { Glass } from "@/components/glass";
import { Surface } from "@/components/surface";
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
  /** Frosted glass card instead of the solid surface. */
  glass?: boolean;
  onPress?: () => void;
};

/**
 * Full-width list row on a card: icon badge, title block, and an optional
 * trailing figure with its own caption. Pressable rows without a figure end in
 * a chevron.
 */
const ListCard = ({
  icon: IconComponent,
  title,
  subtitle,
  value,
  valueLabel,
  glass = false,
  onPress,
}: ListCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const Card = glass ? Glass : Surface;

  const card = (
    <Card style={styles.card}>
      <View style={styles.iconBadge}>
        <IconComponent size={IconSize.md} color={theme.colors.text} weight="duotone" />
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
      ) : onPress ? (
        <CaretRightIcon size={IconSize.sm} color={theme.colors.textTertiary} weight="bold" />
      ) : null}
    </Card>
  );

  if (!onPress) return card;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value, valueLabel].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {card}
    </Pressable>
  );
};

export default ListCard;
