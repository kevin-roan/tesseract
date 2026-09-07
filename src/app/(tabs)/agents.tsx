import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function AgentsScreen() {
  const { gutter } = useAppTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { padding: gutter }]}>
        <ThemedText variant="h1">Agents</ThemedText>
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
  },
});
