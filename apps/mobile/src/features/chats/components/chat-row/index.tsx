import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { FolderIcon } from "phosphor-react-native";

import { Glass } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import createStyles from "./styles";

export type ChatRowProps = {
  title: string;
  preview: string | null;
  project: string | null;
  time: string;
  tokens: string;
  active: boolean;
  onPress: () => void;
};

const ChatRow = ({ title, preview, project, time, tokens, active, onPress }: ChatRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const label = [title, active ? "active" : null, project, time, `${tokens} tokens`].filter(Boolean).join(", ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Glass style={styles.card}>
        <View style={styles.top}>
          <ThemedText variant="h4" numberOfLines={1} style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText variant="caption" color="textTertiary">
            {time}
          </ThemedText>
        </View>
        {preview ? (
          <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={2} style={styles.preview}>
            {preview}
          </ThemedText>
        ) : null}
        <View style={styles.meta}>
          {project ? (
            <View style={styles.project}>
              <FolderIcon size={IconSize.xs} color={theme.colors.textSecondary} weight="duotone" />
              <ThemedText variant="caption" color="textSecondary" numberOfLines={1} style={styles.projectLabel}>
                {project}
              </ThemedText>
            </View>
          ) : null}
          {active ? (
            <View style={styles.active}>
              <View style={styles.dot} />
              <ThemedText variant="caption" color="success">
                Active
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.spacer} />
          <ThemedText variant="caption" color="textTertiary">
            {tokens} tokens
          </ThemedText>
        </View>
      </Glass>
    </Pressable>
  );
};

export default ChatRow;
