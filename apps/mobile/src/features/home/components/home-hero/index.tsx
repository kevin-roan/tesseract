import { useMemo } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";

import GlassTesseract from "@/components/glass-tesseract";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";

import Headline from "./headline";
import createStyles from "./styles";

const HomeHero = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const markEntering = useEntrance(0, "loose");
  const { width } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <Animated.View entering={markEntering}>
        <GlassTesseract size={Math.min(width * 0.62, 260)} testID="home-tesseract" />
      </Animated.View>
      <View style={styles.headline}>
        <Headline />
      </View>
    </View>
  );
};

export default HomeHero;
