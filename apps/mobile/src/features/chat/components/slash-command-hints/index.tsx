import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import PressableScale from "@/components/pressable-scale";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLayoutMotion } from "@/hooks/use-layout-motion";

import type { CommandHint } from "../../utils/slash-commands";
import createStyles from "./styles";

export type SlashCommandHintsProps = {
  items: readonly CommandHint[];
  onSelect: (name: string) => void;
  testID?: string;
};

const SlashCommandHints = ({ items, onSelect, testID = "slash-command-hints" }: SlashCommandHintsProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const motion = useLayoutMotion();

  if (items.length === 0) return null;

  return (
    <Animated.View entering={motion.fadeIn} exiting={motion.fadeOut} layout={motion.layout} style={styles.card} testID={testID}>
      {items.map((item) => (
        <PressableScale
          key={item.name}
          depth="card"
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityHint={item.description || undefined}
          onPress={() => onSelect(item.name)}
          style={styles.row}
          pressedStyle={styles.pressed}
        >
          <View style={styles.text}>
            <ThemedText variant="code" numberOfLines={1}>
              {item.label}
            </ThemedText>
            {item.description ? (
              <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
                {item.description}
              </ThemedText>
            ) : null}
          </View>
          <TagChip label={item.tag.label} tone={item.tag.tone} tinted />
        </PressableScale>
      ))}
    </Animated.View>
  );
};

export default SlashCommandHints;
