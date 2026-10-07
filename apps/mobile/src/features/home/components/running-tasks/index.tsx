import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import { SparkleIcon } from "phosphor-react-native";

import IconTile from "@/components/icon-tile";
import StatusBadge from "@/components/status-badge";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { ControlHeight, IconSize } from "@/theme";

import type { RunningTask } from "../../utils/running";
import createStyles from "./styles";

export type RunningTasksProps = {
  tasks: RunningTask[];
  total: number;
  onOpen: (id: string) => void;
  onViewAll: () => void;
  testID?: string;
};

/** Compact list of the agent runs still going, each opening its run; "View all" leads to every task. */
const RunningTasks = ({ tasks, total, onOpen, onViewAll, testID }: RunningTasksProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const entering = useEntrance(1);

  if (tasks.length === 0) return null;

  return (
    <Animated.View entering={entering} style={styles.container} testID={testID}>
      <View style={styles.header}>
        <ThemedText variant="label" color="textSecondary" accessibilityRole="header">
          {`Running · ${total}`}
        </ThemedText>
        <Pressable onPress={onViewAll} accessibilityRole="button" hitSlop={8} testID={testID ? `${testID}-all` : undefined}>
          <ThemedText variant="label" color="textSecondary">
            View all
          </ThemedText>
        </Pressable>
      </View>
      <Surface style={styles.card}>
        {tasks.map((task, index) => (
          <Pressable
            key={task.id}
            onPress={() => onOpen(task.id)}
            accessibilityRole="button"
            accessibilityLabel={`${task.title}, ${task.badge.label}`}
            style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}
            testID={testID ? `${testID}-${task.id}` : undefined}
          >
            <IconTile icon={SparkleIcon} size={ControlHeight.md} iconSize={IconSize.md} radius="md" />
            <View style={styles.body}>
              <ThemedText variant="bodyStrong" numberOfLines={1}>
                {task.title}
              </ThemedText>
              <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
                {task.meta}
              </ThemedText>
            </View>
            <StatusBadge {...task.badge} />
          </Pressable>
        ))}
      </Surface>
    </Animated.View>
  );
};

export default RunningTasks;
