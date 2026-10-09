import { useMemo } from "react";
import Animated from "react-native-reanimated";

import Wordmark from "@/components/wordmark";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";

import createStyles from "./styles";

/** The app name on the home screen, set like the launch splash's wordmark. */
const HomeHero = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const markEntering = useEntrance(0, "loose");

  return (
    <Animated.View entering={markEntering} style={styles.panel}>
      <Wordmark testID="home-wordmark" />
    </Animated.View>
  );
};

export default HomeHero;
