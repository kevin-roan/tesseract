import { useMemo } from "react";
import { Pressable, View } from "react-native";

import ProgressBar from "@/components/progress-bar";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type ComposerBannerProps = {
  title: string;
  message?: string | null;
  progress?: number | null;
  actionLabel: string;
  onAction: () => void;
  testID?: string;
};

const ComposerBanner = ({ title, message, progress, actionLabel, onAction, testID }: ComposerBannerProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.copy}>
        <ThemedText variant="bodyStrong" numberOfLines={2}>
          {title}
        </ThemedText>
        {message ? (
          <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {message}
          </ThemedText>
        ) : null}
      </View>
      {progress !== undefined ? <ProgressBar progress={progress} label={title} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={onAction}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <ThemedText variant="button">{actionLabel}</ThemedText>
      </Pressable>
    </View>
  );
};

export default ComposerBanner;
