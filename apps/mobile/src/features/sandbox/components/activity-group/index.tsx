import { memo, useMemo } from "react";
import { Pressable, View } from "react-native";
import { CaretRightIcon } from "phosphor-react-native";

import Reveal from "@/components/reveal";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { TranscriptActivity } from "@/features/chat/utils/transcript";
import { HitSlop, IconSize } from "@/theme";

import { useActivityGroup } from "../../hooks/use-activity-group";
import AgentEvent from "../agent-event";
import createStyles from "./styles";

export type ActivityGroupProps = {
  activity: TranscriptActivity;
};

/** Claude's tool calls between two replies: "Working 00:04" while live, "Worked for 6m" once done; tap to unfold. */
const ActivityGroup = ({ activity }: ActivityGroupProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const group = useActivityGroup(activity);

  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: group.expanded, disabled: !group.toggle }}
        accessibilityLabel={[group.title, group.value].filter(Boolean).join(" ")}
        hitSlop={HitSlop.sm}
        disabled={!group.toggle}
        onPress={group.toggle}
        style={styles.summary}
      >
        <ThemedText variant="bodySmall" color="textTertiary">
          {group.title}
        </ThemedText>
        {group.value ? (
          <ThemedText variant="bodySmall" color={group.active ? "text" : "textTertiary"} style={styles.value}>
            {group.value}
          </ThemedText>
        ) : null}
        {group.toggle ? (
          <CaretRightIcon
            size={IconSize.xs}
            color={theme.colors.textTertiary}
            weight="bold"
            style={group.expanded ? styles.caretOpen : undefined}
          />
        ) : null}
      </Pressable>
      {group.line && !group.expanded ? (
        <Reveal key={group.line} style={styles.rail}>
          <ThemedText variant="body" numberOfLines={2} testID="activity-line">
            {group.line}
          </ThemedText>
        </Reveal>
      ) : null}
      {group.expanded ? (
        <Reveal style={[styles.rail, styles.steps]}>
          {activity.events.map((event) => (
            <AgentEvent key={event.seq} event={event} />
          ))}
        </Reveal>
      ) : null}
    </View>
  );
};

export default memo(ActivityGroup);
