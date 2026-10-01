import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { CaretRightIcon } from "phosphor-react-native";

import StatusBadge from "@/components/status-badge";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import type { SessionSummary } from "../../utils/activity";
import createStyles from "./styles";

export type SessionRowProps = {
  rank: number;
  session: SessionSummary;
  onPress?: () => void;
  testID?: string;
};

const SessionRow = ({ rank, session, onPress, testID }: SessionRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const label = `${rank}. ${session.title}, ${session.tokens} tokens, ${session.meta}${session.active ? ", working now" : ""}`;

  const content = (
    <>
      <ThemedText variant="label" color="textTertiary" style={styles.rank}>
        {rank}
      </ThemedText>
      <View style={styles.body}>
        <ThemedText variant="label" numberOfLines={1}>
          {session.title}
        </ThemedText>
        <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
          {session.meta}
        </ThemedText>
      </View>
      <View style={styles.end}>
        <ThemedText variant="bodyStrong" style={styles.value}>
          {session.tokens}
        </ThemedText>
        {session.active ? (
          <View>
            <StatusBadge label="Working" tone="success" />
          </View>
        ) : null}
      </View>
      {onPress ? <CaretRightIcon size={IconSize.sm} color={theme.colors.textTertiary} /> : null}
    </>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={testID}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.row} accessible accessibilityLabel={label} testID={testID}>
      {content}
    </View>
  );
};

export default SessionRow;
