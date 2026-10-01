import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import type { Icon } from "phosphor-react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { Durations } from "@/theme";

import createStyles, { HERO_ORB_ICON_SIZE } from "./styles";

export type HeroOrbProps = {
  icon: Icon;
};

const HeroOrb = ({ icon: IconComponent }: HeroOrbProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: Durations.slowest * 3, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath]);

  const outer = useAnimatedStyle(() => ({
    opacity: 0.35 + breath.value * 0.25,
    transform: [{ scale: 1 + breath.value * 0.08 }],
  }));
  const inner = useAnimatedStyle(() => ({
    opacity: 0.6 + breath.value * 0.3,
    transform: [{ scale: 1 + breath.value * 0.04 }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ring, styles.outer, outer]} />
      <Animated.View style={[styles.ring, styles.inner, inner]} />
      <View style={styles.core}>
        <IconComponent size={HERO_ORB_ICON_SIZE} color={theme.colors.textOnAccent} weight="duotone" />
      </View>
    </View>
  );
};

export default HeroOrb;
