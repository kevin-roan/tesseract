import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { GlassButton } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function HomeScreen() {
  const theme = useAppTheme();

  return (
    <ThemedView style={styles.container}>
      {/* Glass only reads against something — give it a gradient to refract. */}
      <LinearGradient
        colors={[
          theme.colors.accent,
          theme.colors.voiceActive,
          theme.colors.background,
        ]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView
        style={[
          styles.safeArea,
          { gap: theme.sectionGap, padding: theme.gutter },
        ]}
      >
        <ThemedText variant="h1" color="textOnAccent">
          Home
        </ThemedText>
        <GlassButton onPress={() => {}} effect="clear">
          <ThemedText variant="button" color="textOnAccent">
            Get started
          </ThemedText>
        </GlassButton>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
