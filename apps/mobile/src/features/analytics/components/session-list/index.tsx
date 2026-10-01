import { useMemo } from "react";
import { View } from "react-native";
import type { ClaudeSession } from "@theone/protocol";

import { ThemedText } from "@/components/themed-text";

import { summarizeSession } from "../../utils/activity";
import SessionRow from "../session-row";

export type SessionListProps = {
  sessions: ClaudeSession[];
  onPress: (session: ClaudeSession) => (() => void) | undefined;
  caption?: string;
  testID?: string;
};

const SessionList = ({ sessions, onPress, caption, testID }: SessionListProps) => {
  const rows = useMemo(() => sessions.map((session) => ({ session, summary: summarizeSession(session) })), [sessions]);

  return (
    <View testID={testID}>
      {caption ? (
        <ThemedText variant="caption" color="textSecondary">
          {caption}
        </ThemedText>
      ) : null}
      {rows.map(({ session, summary }, index) => (
        <SessionRow
          key={session.sessionId}
          rank={index + 1}
          session={summary}
          onPress={onPress(session)}
          testID={`session-${session.sessionId}`}
        />
      ))}
    </View>
  );
};

export default SessionList;
