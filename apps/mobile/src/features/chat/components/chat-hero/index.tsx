import { useMemo } from "react";
import { View } from "react-native";

import AuraOrb from "@/components/aura-orb";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { useFitSize } from "./hooks/use-fit-size";
import createStyles from "./styles";

export type ChatHeroProps = {
  title: string;
  subtitle?: string;
};

const ChatHero = ({ title, subtitle }: ChatHeroProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const orb = useFitSize();

  return (
    <View style={styles.container}>
      <View style={styles.titles}>
        <ThemedText variant="h1" accessibilityRole="header" style={styles.title}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.orb} onLayout={orb.onLayout}>
        {orb.size > 0 ? <AuraOrb size={orb.size} /> : null}
      </View>
    </View>
  );
};

export default ChatHero;
