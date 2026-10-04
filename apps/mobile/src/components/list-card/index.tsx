import { useMemo } from "react";
import { View } from "react-native";
import { CaretRightIcon, type Icon } from "phosphor-react-native";

import { Glass } from "@/components/glass";
import IconTile from "@/components/icon-tile";
import PressableScale from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import createStyles, { iconTileSize } from "./styles";

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
      <IconTile icon={IconComponent} size={iconTileSize(theme)} iconSize={IconSize.md} radius="md" />

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
          <ThemedText variant="h4" numberOfLines={1} style={styles.figure}>
            {value}
          </ThemedText>
          {valueLabel ? (
            <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
              {valueLabel}
            </ThemedText>
          ) : null}
        </View>
      ) : onPress ? (
        <CaretRightIcon size={IconSize.sm} color={theme.colors.textTertiary} weight="regular" />
      ) : null}
    </Card>
  );

  if (!onPress) return card;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, value, valueLabel].filter(Boolean).join(", ")}
      onPress={onPress}
    >
      {card}
    </PressableScale>
  );
};

export default ListCard;
