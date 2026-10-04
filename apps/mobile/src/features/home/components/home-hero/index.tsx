import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";

import Headline from "./headline";
import Monolith from "./monolith";
import createStyles from "./styles";

const HomeHero = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const markEntering = useEntrance(0, "loose");

  return (
    <View style={styles.container}>
      <Animated.View
        entering={markEntering}
        testID="home-monolith"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Monolith />
      </Animated.View>
      <View style={styles.headline}>
        <Headline />
      </View>
    </View>
  );
};

export default HomeHero;
