import { useMemo } from "react";
import { View } from "react-native";

import ClaudeMark from "@/components/claude-mark";
import Greeting from "@/components/greeting";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type HomeHeroProps = {
  name?: string | null;
};

const HomeHero = ({ name }: HomeHeroProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <ClaudeMark />
      <Greeting name={name} />
    </View>
  );
};

export default HomeHero;
