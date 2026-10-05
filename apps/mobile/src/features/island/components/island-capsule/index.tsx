import { useMemo } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { GestureDetector, type GestureType } from "react-native-gesture-handler";
import Animated, { type AnimatedStyle } from "react-native-reanimated";

import DotShape from "@/components/dot-shape";
import PressableScale from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { MaxFontSizeMultiplier } from "@/theme";

import type { IslandState } from "@/modules/theone-island";

import { useIslandSummary } from "../../hooks/use-island-summary";
import { ISLAND_CAPSULE_GLYPH_SIZE } from "../../utils/constants";
import createStyles from "./styles";

export type IslandCapsuleProps = {
  state: IslandState;
  sharedCount: number;
  hasDraft: boolean;
  /** What is going on, read out before the value. */
  title: string;
  expanded: boolean;
  onPress: () => void;
  gesture: GestureType;
  style?: AnimatedStyle<ViewStyle>;
  testID?: string;
};

/** Collapsed island: a live glyph and one short value. Tap to expand, drag to move. */
const IslandCapsule = ({ state, sharedCount, hasDraft, title, expanded, onPress, gesture, style, testID }: IslandCapsuleProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const press = useHapticPress(onPress);
  const { value, live } = useIslandSummary(state, sharedCount, hasDraft);

  return (
    <Animated.View
      style={[styles.capsule, style]}
      pointerEvents={expanded ? "none" : "box-none"}
      accessibilityElementsHidden={expanded}
      importantForAccessibility={expanded ? "no-hide-descendants" : "auto"}
    >
      <GestureDetector gesture={gesture}>
        <View style={styles.fill} collapsable={false}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={live ? `${title}, ${value}` : title}
            accessibilityHint="Shows running work and controls"
            accessibilityState={{ expanded }}
            onPress={press}
            style={styles.press}
            testID={testID}
          >
            <DotShape
              size={ISLAND_CAPSULE_GLYPH_SIZE}
              color={live ? theme.colors.text : theme.colors.textTertiary}
              dots={10}
              dotSize={2}
              animate={live}
            />
            <Text style={styles.value} numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
              {value}
            </Text>
          </PressableScale>
        </View>
      </GestureDetector>
    </Animated.View>
  );
};

export default IslandCapsule;
