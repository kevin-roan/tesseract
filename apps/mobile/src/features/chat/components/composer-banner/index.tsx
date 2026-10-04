import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import PressableScale from "@/components/pressable-scale";
import ProgressBar from "@/components/progress-bar";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";

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
  const entering = useEntrance();

  return (
    <Animated.View entering={entering} style={styles.card} testID={testID}>
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
      {progress !== undefined ? <ProgressBar progress={progress} tone="neutral" label={title} /> : null}
      <PressableScale
        depth="control"
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={onAction}
        style={styles.action}
      >
        <ThemedText variant="button">{actionLabel}</ThemedText>
      </PressableScale>
    </Animated.View>
  );
};

export default ComposerBanner;
