import { memo, useMemo } from "react";
import { View } from "react-native";
import { CheckCircleIcon, WrenchIcon, XCircleIcon } from "phosphor-react-native";
import type { AgentRunEvent } from "@theone/protocol";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import createStyles from "./styles";

export type AgentEventProps = {
  event: AgentRunEvent;
};

const AgentEvent = ({ event }: AgentEventProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  switch (event.kind) {
    case "text":
      return (
        <ThemedText variant="body" color="bubbleAssistantText" selectable>
          {event.text}
        </ThemedText>
      );
    case "tool_use":
      return (
        <View style={styles.tool}>
          <WrenchIcon size={IconSize.sm} color={theme.colors.accentPressed} weight="bold" style={styles.icon} />
          <View style={styles.toolBody}>
            <ThemedText variant="label">{event.tool}</ThemedText>
            <ThemedText variant="code" color="textSecondary" numberOfLines={3} selectable>
              {event.summary}
            </ThemedText>
          </View>
        </View>
      );
    case "tool_result": {
      const ResultIcon = event.isError ? XCircleIcon : CheckCircleIcon;
      return (
        <View style={[styles.tool, event.isError && styles.toolError]}>
          <ResultIcon
            size={IconSize.sm}
            color={event.isError ? theme.colors.danger : theme.colors.success}
            weight="fill"
            style={styles.icon}
          />
          <View style={styles.toolBody}>
            {event.tool ? <ThemedText variant="label">{event.tool}</ThemedText> : null}
            <ThemedText variant="code" color="textSecondary" numberOfLines={4} selectable>
              {event.summary}
            </ThemedText>
          </View>
        </View>
      );
    }
    case "system":
      return (
        <ThemedText variant="caption" color="textTertiary" style={styles.system}>
          {event.text}
        </ThemedText>
      );
  }
};

export default memo(AgentEvent);
