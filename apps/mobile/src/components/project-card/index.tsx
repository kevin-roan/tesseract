import { useMemo } from "react";
import { Pressable, View } from "react-native";
import {
  CaretDoubleRightIcon,
  ChatCircleIcon,
  CheckCircleIcon,
  CircleDashedIcon,
  DotsThreeIcon,
  PauseCircleIcon,
  TrendUpIcon,
  type Icon,
} from "phosphor-react-native";

import AvatarStack, { type AvatarPerson } from "@/components/avatar-stack";
import { GlassPill, GlassSurface } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, IconSize, type ThemeColor } from "@/theme";

import createStyles from "./styles";

export type ProjectStatus = "ongoing" | "completed" | "paused";
export type ProjectPriority = "high" | "medium" | "low";

export type ProjectCardProps = {
  title: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  /** Pre-formatted date range, e.g. "06.09 - 12.10". */
  timeline: string;
  people: AvatarPerson[];
  onPress?: () => void;
  onPressMenu?: () => void;
  onPressChat?: () => void;
};

const StatusMeta: Record<
  ProjectStatus,
  { label: string; icon: Icon; color: ThemeColor }
> = {
  ongoing: { label: "Ongoing", icon: CircleDashedIcon, color: "text" },
  completed: { label: "Completed", icon: CheckCircleIcon, color: "success" },
  paused: { label: "Paused", icon: PauseCircleIcon, color: "textTertiary" },
};

const PriorityMeta: Record<
  ProjectPriority,
  { label: string; color: ThemeColor; background: ThemeColor }
> = {
  high: { label: "High", color: "warning", background: "warningMuted" },
  medium: { label: "Medium", color: "accentPressed", background: "accentMuted" },
  low: { label: "Low", color: "success", background: "successMuted" },
};

/**
 * Project summary on a glass card: title with an overflow menu, a three-column
 * status / priority / timeline strip, and a footer pairing the member stack
 * with the shortcut into the project's conversation.
 */
const ProjectCard = ({
  title,
  status,
  priority,
  timeline,
  people,
  onPress,
  onPressMenu,
  onPressChat,
}: ProjectCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const statusMeta = StatusMeta[status];
  const priorityMeta = PriorityMeta[priority];
  const StatusIcon = statusMeta.icon;

  const peopleLabel = people.length === 1 ? "1 person" : `${people.length} people`;

  const card = (
    <GlassSurface style={styles.card}>
      <View style={styles.header}>
        <ThemedText variant="h3" style={styles.title} numberOfLines={2}>
          {title}
        </ThemedText>

        {onPressMenu ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More options for ${title}`}
            hitSlop={HitSlop.md}
            onPress={onPressMenu}
            style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
          >
            <DotsThreeIcon
              size={IconSize.lg}
              color={theme.colors.textSecondary}
              weight="bold"
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaColumn}>
          <ThemedText variant="caption" color="textTertiary">
            Status
          </ThemedText>
          <View style={styles.metaValueRow}>
            <StatusIcon
              size={IconSize.sm}
              color={theme.colors[statusMeta.color]}
              weight="duotone"
            />
            <ThemedText variant="bodySmall" numberOfLines={1}>
              {statusMeta.label}
            </ThemedText>
          </View>
        </View>

        <View style={styles.metaColumn}>
          <ThemedText variant="caption" color="textTertiary">
            Priority
          </ThemedText>
          <View
            style={[
              styles.priorityPill,
              { backgroundColor: theme.colors[priorityMeta.background] },
            ]}
          >
            <ThemedText variant="caption" color={priorityMeta.color}>
              {priorityMeta.label}
            </ThemedText>
            {priority === "high" ? (
              <TrendUpIcon
                size={IconSize.xs}
                color={theme.colors[priorityMeta.color]}
                weight="bold"
              />
            ) : null}
          </View>
        </View>

        <View style={styles.metaColumn}>
          <ThemedText variant="caption" color="textTertiary">
            Timeline
          </ThemedText>
          <ThemedText variant="bodySmall" numberOfLines={1}>
            {timeline}
          </ThemedText>
        </View>
      </View>

      <View style={styles.footer}>
        <GlassPill style={styles.peoplePill}>
          <AvatarStack people={people} />
          <View>
            <ThemedText variant="caption" color="textSecondary">
              {peopleLabel}
            </ThemedText>
            <ThemedText variant="caption" color="textTertiary">
              in this project
            </ThemedText>
          </View>
        </GlassPill>

        {onPressChat ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${title} conversation`}
            onPress={onPressChat}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          >
            <ChatCircleIcon
              size={IconSize.lg}
              color={theme.colors.textOnAccent}
              weight="fill"
            />
          </Pressable>
        ) : null}

        <CaretDoubleRightIcon
          size={IconSize.md}
          color={theme.colors.textTertiary}
          weight="bold"
        />
      </View>
    </GlassSurface>
  );

  if (!onPress) return card;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${statusMeta.label}, ${priorityMeta.label} priority, ${timeline}`}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {card}
    </Pressable>
  );
};

export default ProjectCard;
