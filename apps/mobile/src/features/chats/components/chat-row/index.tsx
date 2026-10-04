import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { ChatCircleIcon, FolderIcon } from "phosphor-react-native";

import IconTile from "@/components/icon-tile";
import PressableScale from "@/components/pressable-scale";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { ControlHeight, IconSize } from "@/theme";

import createStyles from "./styles";

export type ChatRowProps = {
  title: string;
  preview: string | null;
  project: string | null;
  time: string;
  tokens: string;
  active: boolean;
  divider?: boolean;
  entranceIndex?: number;
  onPress: () => void;
};

const ChatRow = ({ title, preview, project, time, tokens, active, divider = false, entranceIndex = 0, onPress }: ChatRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const entering = useEntrance(entranceIndex);
  const label = [title, active ? "active" : null, project, time, `${tokens} tokens`].filter(Boolean).join(", ");

  return (
    <Animated.View entering={entering} style={divider && styles.divider}>
      <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.row}>
        <IconTile icon={ChatCircleIcon} size={ControlHeight.md} iconSize={IconSize.md} radius="md" />
        <View style={styles.body}>
          <View style={styles.top}>
            <ThemedText variant="bodyStrong" numberOfLines={1} style={styles.title}>
              {title}
            </ThemedText>
            <ThemedText variant="caption" color="textTertiary" numberOfLines={1} style={styles.figure}>
              {time}
            </ThemedText>
          </View>
          {preview ? (
            <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={2}>
              {preview}
            </ThemedText>
          ) : null}
          <View style={styles.meta}>
            {project ? (
              <View style={styles.project}>
                <TagChip label={project} icon={FolderIcon} />
              </View>
            ) : null}
            {active ? <TagChip label="Active" tone="success" dot /> : null}
            <View style={styles.spacer} />
            <ThemedText variant="caption" color="textTertiary" style={styles.figure}>
              {tokens} tokens
            </ThemedText>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
};

export default ChatRow;
