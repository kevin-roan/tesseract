import { useMemo } from "react";
import { View } from "react-native";
import { StopIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";

import createStyles from "./styles";

export type IslandRowProps = {
  title: string;
  details: (string | null)[];
  stopLabel: string;
  onStop: () => void;
  stopping?: boolean;
  onPress?: () => void;
  testID?: string;
};

const IslandRow = ({ title, details, stopLabel, onStop, stopping = false, onPress, testID }: IslandRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const press = useHapticPress(onPress);
  const subtitle = details.filter(Boolean).join(" · ");

  return (
    <View style={styles.row} testID={testID}>
      <PressableScale
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={title}
        accessibilityHint={onPress ? "Opens the details" : undefined}
        onPress={press}
        disabled={!onPress}
        style={styles.body}
      >
        <ThemedText variant="label" numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText variant="caption" color="textSecondary" numberOfLines={1} style={styles.details}>
            {subtitle}
          </ThemedText>
        ) : null}
      </PressableScale>
      <ActionButton
        label={stopLabel}
        icon={StopIcon}
        variant="secondary"
        size="sm"
        loading={stopping}
        onPress={onStop}
        accessibilityLabel={`${stopLabel} ${title}`}
      />
    </View>
  );
};

export default IslandRow;
