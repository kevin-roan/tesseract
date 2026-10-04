import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import ClaudeMark from "@/components/claude-mark";
import { Greeting } from "@/components/greeting";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { IconSize } from "@/theme";

import createStyles from "./styles";

export type HomeHeroProps = {
  name?: string | null;
};

const HomeHero = ({ name }: HomeHeroProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tileEntering = useEntrance(0, "loose");
  const greetingEntering = useEntrance(1, "loose");

  return (
    <View style={styles.container}>
      <Animated.View
        entering={tileEntering}
        style={styles.tile}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <ClaudeMark size={IconSize.xl} color={theme.colors.text} />
      </Animated.View>
      <Animated.View entering={greetingEntering}>
        <Greeting name={name} />
      </Animated.View>
    </View>
  );
};

export default HomeHero;
