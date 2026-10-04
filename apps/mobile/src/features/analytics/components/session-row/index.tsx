import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { CaretRightIcon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";
import { useEntrance } from "@/hooks/use-entrance";

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
  const entering = useEntrance(rank - 1, "tight");
  const label = `${rank}. ${session.title}, ${session.tokens} tokens, ${session.meta}${session.active ? ", working now" : ""}`;

  const content = (
    <>
      <View style={styles.rank}>
        <ThemedText variant="caption" color="textSecondary" style={styles.rankText}>
          {rank}
        </ThemedText>
      </View>
      <View style={styles.body}>
        <ThemedText variant="label" numberOfLines={1}>
          {session.title}
        </ThemedText>
        <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
          {session.meta}
        </ThemedText>
      </View>
      <View style={styles.end}>
        <ThemedText variant="label" style={styles.value}>
          {session.tokens}
        </ThemedText>
        {session.active ? <TagChip label="Working" tone="success" dot /> : null}
      </View>
      {onPress ? <CaretRightIcon size={IconSize.sm} color={theme.colors.textTertiary} weight="light" /> : null}
    </>
  );

  return (
    <Animated.View entering={entering}>
      {onPress ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          style={styles.row}
          testID={testID}
        >
          {content}
        </PressableScale>
      ) : (
        <View style={styles.row} accessible accessibilityLabel={label} testID={testID}>
          {content}
        </View>
      )}
    </Animated.View>
  );
};

export default SessionRow;
