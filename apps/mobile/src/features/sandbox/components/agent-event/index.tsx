import { memo, useMemo } from "react";
import { View } from "react-native";
import { CheckCircleIcon, WrenchIcon, XCircleIcon } from "phosphor-react-native";
import type { AgentRunEvent } from "@tesseract/protocol";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import ToolRow from "../tool-row";
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
      return <ToolRow icon={WrenchIcon} iconColor="text" tool={event.tool} summary={event.summary} lines={3} />;
    case "tool_result":
      return (
        <ToolRow
          icon={event.isError ? XCircleIcon : CheckCircleIcon}
          iconColor={event.isError ? "danger" : "success"}
          tool={event.tool}
          summary={event.summary}
          lines={4}
          error={event.isError}
        />
      );
    case "system":
      return (
        <View style={styles.system}>
          <View style={styles.rule} />
          <ThemedText variant="caption" color="textTertiary" style={styles.systemText}>
            {event.text}
          </ThemedText>
          <View style={styles.rule} />
        </View>
      );
  }
};

export default memo(AgentEvent);
