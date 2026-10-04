import { useMemo } from "react";
import { View } from "react-native";
import {
  CaretDoubleRightIcon,
  ChatCircleIcon,
  DotsThreeIcon,
  type Icon,
} from "phosphor-react-native";

import AvatarStack, { type AvatarPerson } from "@/components/avatar-stack";
import PressableScale from "@/components/pressable-scale";
import { SurfacePill, Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors, type Tone } from "@/lib/tone";
import { HitSlop, IconSize } from "@/theme";

import createStyles from "./styles";

export type ProjectCardField = {
  /** Small heading above the value, e.g. "Status". */
  caption: string;
  value: string;
  tone?: Tone;
  icon?: Icon;
};

export type ProjectCardProps = {
  title: string;
  subtitle?: string;
  /** First column: an icon tinted by tone next to the value. */
  status: ProjectCardField;
  /** Second column: the value inside a tinted pill. */
  tag: ProjectCardField;
  /** Third column: plain text. */
  detail: ProjectCardField;
  members: AvatarPerson[];
  /** First line next to the avatar row, e.g. "3 active tasks". */
  membersTitle: string;
  membersCaption?: string;
  chatLabel?: string;
  testID?: string;
  onPress?: () => void;
  onPressMenu?: () => void;
  onPressChat?: () => void;
};

/**
 * Project summary on a card: title with an overflow menu, a three-column
 * status / tag / detail strip, and a footer pairing an avatar row with the
 * shortcut into the project's conversation.
 */
const ProjectCard = ({
  title,
  subtitle,
  status,
  tag,
  detail,
  members,
  membersTitle,
  membersCaption,
  chatLabel = `Open ${title} conversation`,
  testID,
  onPress,
  onPressMenu,
  onPressChat,
}: ProjectCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const statusColors = ToneColors[status.tone ?? "neutral"];
  const tagTone = tag.tone ?? "info";
  const tagInk = tagTone === "info" || tagTone === "neutral" ? "textSecondary" : ToneColors[tagTone].foreground;
  const StatusIcon = status.icon;
  const TagIcon = tag.icon;

  const card = (
    <Surface style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <ThemedText variant="h4" numberOfLines={2}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>

        {onPressMenu ? (
          <PressableScale
            depth="control"
            accessibilityRole="button"
            accessibilityLabel={`More options for ${title}`}
            hitSlop={HitSlop.md}
            onPress={onPressMenu}
            style={styles.menuButton}
          >
            <DotsThreeIcon
              size={IconSize.lg}
              color={theme.colors.textSecondary}
              weight="regular"
            />
          </PressableScale>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaColumn}>
          <ThemedText variant="caption" color="textTertiary">
            {status.caption}
          </ThemedText>
          <View style={styles.metaValueRow}>
            {StatusIcon ? (
              <StatusIcon
                size={IconSize.sm}
                color={theme.colors[statusColors.foreground]}
                weight="regular"
              />
            ) : null}
            <ThemedText variant="bodySmall" numberOfLines={1} style={styles.shrink}>
              {status.value}
            </ThemedText>
          </View>
        </View>

        <View style={styles.metaColumn}>
          <ThemedText variant="caption" color="textTertiary">
            {tag.caption}
          </ThemedText>
          <View style={styles.tagPill}>
            {TagIcon ? <TagIcon size={IconSize.xs} color={theme.colors[tagInk]} weight="regular" /> : null}
            <ThemedText variant="caption" color={tagInk} numberOfLines={1} style={styles.shrink}>
              {tag.value}
            </ThemedText>
          </View>
        </View>

        <View style={styles.metaColumn}>
          <ThemedText variant="caption" color="textTertiary">
            {detail.caption}
          </ThemedText>
          <ThemedText variant="bodySmall" numberOfLines={1}>
            {detail.value}
          </ThemedText>
        </View>
      </View>

      <View style={styles.footer}>
        <SurfacePill style={styles.membersPill}>
          {members.length > 0 ? <AvatarStack people={members} /> : null}
          <View style={styles.shrink}>
            <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
              {membersTitle}
            </ThemedText>
            {membersCaption ? (
              <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
                {membersCaption}
              </ThemedText>
            ) : null}
          </View>
        </SurfacePill>

        {onPressChat ? (
          <PressableScale
            depth="control"
            accessibilityRole="button"
            accessibilityLabel={chatLabel}
            onPress={onPressChat}
            style={styles.actionButton}
          >
            <ChatCircleIcon
              size={IconSize.md}
              color={theme.colors.textOnAccent}
              weight="light"
            />
          </PressableScale>
        ) : null}

        <CaretDoubleRightIcon
          size={IconSize.md}
          color={theme.colors.textTertiary}
          weight="light"
        />
      </View>
    </Surface>
  );

  if (!onPress) return <View testID={testID}>{card}</View>;

  // The chat and menu buttons sit inside the card's own button, which screen
  // readers flatten into one element — so they are offered as custom actions.
  const actions = [
    ...(onPressChat ? [{ name: "chat", label: chatLabel }] : []),
    ...(onPressMenu ? [{ name: "menu", label: `More options for ${title}` }] : []),
  ];

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${status.value}, ${tag.value}, ${detail.value}`}
      accessibilityActions={actions.length ? actions : undefined}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === "chat") onPressChat?.();
        if (nativeEvent.actionName === "menu") onPressMenu?.();
      }}
      onPress={onPress}
    >
      {card}
    </PressableScale>
  );
};

export default ProjectCard;
