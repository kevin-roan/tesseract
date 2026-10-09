import { useMemo } from "react";
import Animated from "react-native-reanimated";

import Monolith from "@/components/monolith";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";

import { useHomeHero } from "../../hooks/use-home-hero";
import createStyles from "./styles";

/** The launch splash's obelisk on the home screen, its edges lit each time Home comes back into view. */
const HomeHero = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const markEntering = useEntrance(0, "loose");
  const hero = useHomeHero();

  return (
    <Animated.View
      entering={markEntering}
      style={styles.panel}
      onLayout={hero.measure}
      testID="home-obelisk"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {hero.ready ? <Monolith width={hero.box.width} height={hero.box.height} clock={hero.clock} /> : null}
    </Animated.View>
  );
};

export default HomeHero;
