import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { MaxFontSizeMultiplier } from "@/theme";

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
        <View style={styles.top}>
          <ThemedText variant="label" numberOfLines={1} style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText
            variant="caption"
            color="textTertiary"
            numberOfLines={1}
            maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
            style={styles.figure}
          >
            {time}
          </ThemedText>
        </View>
        {preview ? (
          <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={1}>
            {preview}
          </ThemedText>
        ) : null}
        <View style={styles.meta}>
          {project ? (
            <ThemedText variant="caption" color="textTertiary" numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome} style={styles.project}>
              {project}
            </ThemedText>
          ) : null}
          <ThemedText variant="caption" color="textTertiary" maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome} style={styles.figure}>
            {project ? "· " : ""}
            {tokens} tokens
          </ThemedText>
          {active ? (
            <ThemedText variant="caption" color="success" maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
              · Active
            </ThemedText>
          ) : null}
        </View>
      </PressableScale>
    </Animated.View>
  );
};

export default ChatRow;
