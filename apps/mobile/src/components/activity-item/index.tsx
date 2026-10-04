import { Fragment, useMemo } from "react";
import { View } from "react-native";

import Avatar from "@/components/avatar";
import { Glass } from "@/components/glass";
import PressableScale from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
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
  testID?: string;
  /** Frosted glass card instead of the solid surface. */
  glass?: boolean;
  /** Bare row with no card, for stacking inside a grouped list. */
  plain?: boolean;
  onPress?: () => void;
};

export type ActivityListProps = {
  items: (Omit<ActivityItemProps, "glass" | "plain"> & { id: string })[];
  testID?: string;
};

/**
 * One entry in the profile activity feed: who did what, when, and the figures
 * that entry carries. On its own card by default; `plain` for grouped lists.
 */
const ActivityItem = ({
  actor,
  action,
  target,
  timeAgo,
  photo,
  metrics,
  testID,
  glass = false,
  plain = false,
  onPress,
}: ActivityItemProps) => {
  const theme = useAppTheme();
  const size = theme.isTablet ? AvatarSize.lg : AvatarSize.md;
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);

  const Card = plain ? View : glass ? Glass : Surface;

  const card = (
    <Card style={[styles.card, !plain && styles.framed]}>
      <View style={styles.header}>
        <Avatar name={actor} photo={photo} size={size} />

        <View style={styles.headline}>
          <ThemedText variant="bodyStrong" numberOfLines={1}>
            {actor}
          </ThemedText>
          <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {action} <ThemedText variant="label" color="text">{target}</ThemedText>
          </ThemedText>
        </View>

        <ThemedText variant="caption" color="textTertiary" numberOfLines={1} style={[styles.time, styles.figure]}>
          {timeAgo}
        </ThemedText>
      </View>

      {metrics?.length ? (
        <View style={styles.metrics}>
          {metrics.map((metric) => (
            <View key={metric.id} style={styles.metric}>
              <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
                {metric.label}
              </ThemedText>
              <ThemedText variant="label" numberOfLines={1} style={styles.figure}>
                {metric.value}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );

  if (!onPress) return <View testID={testID}>{card}</View>;

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${actor} ${action} ${target}, ${timeAgo}`}
      onPress={onPress}
    >
      {card}
    </PressableScale>
  );
};

/** Activity entries grouped on one card, split by hairline dividers. */
export const ActivityList = ({ items, testID }: ActivityListProps) => {
  const theme = useAppTheme();
  const size = theme.isTablet ? AvatarSize.lg : AvatarSize.md;
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);

  return (
    <Surface style={styles.list} testID={testID}>
      {items.map(({ id, ...item }, index) => (
        <Fragment key={id}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <ActivityItem plain {...item} />
        </Fragment>
      ))}
    </Surface>
  );
};

export default ActivityItem;
