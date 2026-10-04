import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import DotSphere from "@/components/dot-sphere";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";

import { useFitSize } from "./hooks/use-fit-size";
import createStyles from "./styles";

export type ChatHeroProps = {
  title: string;
  subtitle?: string;
};

const ChatHero = ({ title, subtitle }: ChatHeroProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mark = useFitSize();
  const titlesEntering = useEntrance(0);
  const markEntering = useEntrance(1, "loose");

  return (
    <View style={styles.container}>
      <Animated.View entering={titlesEntering} style={styles.titles}>
        <ThemedText variant="h2" accessibilityRole="header" style={styles.title}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText variant="body" color="textSecondary" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </Animated.View>
      <Animated.View
        entering={markEntering}
        style={styles.mark}
        onLayout={mark.onLayout}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {mark.size > 0 ? <DotSphere size={mark.size} color="textSecondary" /> : null}
      </Animated.View>
    </View>
  );
};

export default ChatHero;
