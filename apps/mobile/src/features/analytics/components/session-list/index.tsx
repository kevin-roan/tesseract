import { Fragment, useMemo } from "react";
import { View } from "react-native";
import type { ClaudeSession } from "@tesseract/protocol";

import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { summarizeSession } from "../../utils/activity";
import SessionRow from "../session-row";
import createStyles from "./styles";

export type SessionListProps = {
  sessions: ClaudeSession[];
  onPress: (session: ClaudeSession) => (() => void) | undefined;
  caption?: string;
  testID?: string;
};

const SessionList = ({ sessions, onPress, caption, testID }: SessionListProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const rows = useMemo(() => sessions.map((session) => ({ session, summary: summarizeSession(session) })), [sessions]);

  return (
    <View style={styles.list} testID={testID}>
      {caption ? (
        <ThemedText variant="caption" color="textTertiary">
          {caption}
        </ThemedText>
      ) : null}
      {rows.length > 0 ? (
        <Surface>
          {rows.map(({ session, summary }, index) => (
            <Fragment key={session.sessionId}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <SessionRow
                rank={index + 1}
                session={summary}
                onPress={onPress(session)}
                testID={`session-${session.sessionId}`}
              />
            </Fragment>
          ))}
        </Surface>
      ) : null}
    </View>
  );
};

export default SessionList;
