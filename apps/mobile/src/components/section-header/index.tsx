import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type SectionHeaderProps = {
  title: string;
  /** Trailing link, e.g. "View All". Omit for a title-only header. */
  actionLabel?: string;
  onPressAction?: () => void;
};

/**
 * Section title with an optional trailing link. The link only renders when it
 * has somewhere to go, so a header without a handler stays a plain title.
 */
const SectionHeader = ({ title, actionLabel, onPressAction }: SectionHeaderProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      <ThemedText variant="h4" style={styles.title} numberOfLines={1}>
        {title}
      </ThemedText>

      {actionLabel && onPressAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}, ${title}`}
          onPress={onPressAction}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <ThemedText variant="label" color="textSecondary">
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
};

export default SectionHeader;
