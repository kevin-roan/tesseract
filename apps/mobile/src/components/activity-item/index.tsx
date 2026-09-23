import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";

import { GlassSurface } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AvatarSize } from "@/theme";

import createStyles from "./styles";

export type ActivityMetric = {
  id: string;
  /** Pre-formatted figure — "12", "37,6 km". */
  value: string;
  label: string;
};

export type ActivityItemProps = {
  actor: string;
  /** What they did, e.g. "created project". */
  action: string;
  /** What they did it to, emphasised after the action. */
  target: string;
  /** Relative time, pre-formatted — "6h ago". */
  timeAgo: string;
  photo?: string;
  metrics?: ActivityMetric[];
  onPress?: () => void;
};

/** First letter of the first two words — "Ada Lovelace" becomes "AL". */
const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/**
 * One entry in the profile activity feed on a glass card: who did what, when,
 * and the figures that entry carries.
 */
const ActivityItem = ({
  actor,
  action,
  target,
  timeAgo,
  photo,
  metrics,
  onPress,
}: ActivityItemProps) => {
  const theme = useAppTheme();
  const size = theme.isTablet ? AvatarSize.lg : AvatarSize.md;
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);

  const card = (
    <GlassSurface style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <ThemedText variant="caption" color="textSecondary">
              {initialsOf(actor)}
            </ThemedText>
          )}
        </View>

        <View style={styles.headline}>
          <ThemedText variant="bodyStrong" numberOfLines={1}>
            {actor}
          </ThemedText>
          <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {action} <ThemedText variant="bodyStrong">{target}</ThemedText>
          </ThemedText>
        </View>

        <ThemedText variant="caption" color="textTertiary">
          {timeAgo}
        </ThemedText>
      </View>

      {metrics?.length ? (
        <View style={styles.metrics}>
          {metrics.map((metric) => (
            <View key={metric.id} style={styles.metric}>
              <ThemedText variant="h4" numberOfLines={1}>
                {metric.value}
              </ThemedText>
              <ThemedText variant="overline" color="textTertiary" numberOfLines={1}>
                {metric.label}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </GlassSurface>
  );

  if (!onPress) return card;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${actor} ${action} ${target}, ${timeAgo}`}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {card}
    </Pressable>
  );
};

export default ActivityItem;
