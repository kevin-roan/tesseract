import { memo, useMemo } from "react";
import { View } from "react-native";
import type { AgentRun } from "@tesseract/protocol";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import RunMessage from "../run-message";
import createStyles from "./styles";

export type EarlierTurnProps = {
  run: AgentRun;
};

/** An earlier message of the chat and Claude's final reply to it, shown above the run being viewed. */
const EarlierTurn = ({ run }: EarlierTurnProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const reply = run.result?.trim() || run.error;

  return (
    <View style={styles.turn}>
      <RunMessage run={run} />
      {reply ? (
        <ThemedText variant="body" color={run.result ? "bubbleAssistantText" : "danger"} selectable>
          {reply}
        </ThemedText>
      ) : null}
    </View>
  );
};

export default memo(EarlierTurn);
