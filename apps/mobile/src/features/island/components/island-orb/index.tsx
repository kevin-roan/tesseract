import { useMemo } from "react";
import { View, type ViewStyle } from "react-native";
import { GestureDetector, GestureHandlerRootView, type GestureType } from "react-native-gesture-handler";
import Animated, { type AnimatedStyle, type DerivedValue, type SharedValue } from "react-native-reanimated";
import type { Transforms3d } from "@shopify/react-native-skia";

import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { MaxFontSizeMultiplier } from "@/theme";

import { useOrbPulse } from "../../hooks/use-orb-pulse";
import { useOrbSpin } from "../../hooks/use-orb-spin";
import { ISLAND_ORB_SIZE } from "../../utils/constants";
import OrbChrome from "./orb-chrome";
import createStyles from "./styles";

export type IslandOrbProps = {
  label: string;
  /** Shown inside the orb when more than one thing is going on. */
  count: number;
  live: boolean;
  expanded: boolean;
  onPress: () => void;
  gesture: GestureType;
  lift: SharedValue<number>;
  sheen: DerivedValue<Transforms3d>;
  style?: AnimatedStyle<ViewStyle>;
  testID?: string;
};

/** Floating chrome orb for live work: drag it anywhere, a ring sweeps inside the bezel while something runs. */
const IslandOrb = ({ label, count, live, expanded, onPress, gesture, lift, sheen, style, testID }: IslandOrbProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const press = useHapticPress(onPress);
  const spin = useOrbSpin(live);
  const breath = useOrbPulse(live);
  const tint = live ? theme.colors.success : theme.colors.textSecondary;

  return (
    <Animated.View style={[styles.orb, style]} pointerEvents="box-none">
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={gesture}>
          <View style={styles.body} collapsable={false}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={expanded ? "Hides running work" : "Shows running work and controls"}
              accessibilityState={{ expanded }}
              onPress={press}
              style={styles.press}
              testID={testID}
            >
              <OrbChrome
                size={ISLAND_ORB_SIZE}
                tint={tint}
                live={live}
                dot={count <= 1}
                expanded={expanded}
                spin={spin}
                sheen={sheen}
                lift={lift}
                breath={breath}
                style={styles.canvas}
              />
              {count > 1 ? (
                <ThemedText variant="label" maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome} style={styles.count}>
                  {count}
                </ThemedText>
              ) : null}
            </PressableScale>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Animated.View>
  );
};

export default IslandOrb;
