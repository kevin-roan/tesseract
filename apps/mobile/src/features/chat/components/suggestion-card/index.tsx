import { useMemo } from "react";
import Animated from "react-native-reanimated";

import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";

import createStyles from "./styles";

export type SuggestionCardProps = {
  label: string;
  index: number;
  onPress: () => void;
};

const SuggestionCard = ({ label, index, onPress }: SuggestionCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const entering = useEntrance(index);

  return (
    <Animated.View entering={entering}>
      <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.card}>
        <ThemedText variant="bodySmall" numberOfLines={2}>
          {label}
        </ThemedText>
      </PressableScale>
    </Animated.View>
  );
};

export default SuggestionCard;
