import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";

import createStyles from "./styles";

export type ChatHeroProps = {
  title: string;
  subtitle?: string;
};

const ChatHero = ({ title, subtitle }: ChatHeroProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const titlesEntering = useEntrance(0);

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
    </View>
  );
};

export default ChatHero;
