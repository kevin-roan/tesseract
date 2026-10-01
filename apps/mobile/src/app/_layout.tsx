import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';

import { useAppReady } from '@/hooks/use-app-ready';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePortraitLock } from '@/hooks/use-orientation-lock';
import InboxNotifier from '@/features/inbox/components/inbox-notifier';
import IslandHost from '@/features/island/components/island-host';
import AppProviders from '@/providers/app-providers';
import { initMonitoring, useMonitoredNavigation, withMonitoring } from '@/lib/monitoring';

initMonitoring();

// Held until the fonts are registered and the paired sandboxes are known, so no
// frame renders in the fallback face or on the wrong side of the pairing gate.
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { ready, paired } = useAppReady();

  if (!ready) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false, orientation: 'portrait_up' }}>
        <Stack.Protected guard={paired}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade', title: 'Monolith' }} />
          <Stack.Screen name="sandbox/display" options={{ gestureEnabled: false, title: 'Display' }} />
          <Stack.Screen name="sandbox/terminal/[id]" options={{ gestureEnabled: false, title: 'Terminal' }} />
          <Stack.Screen name="sandbox/projects/new" options={{ title: 'New project' }} />
          <Stack.Screen name="sandbox/projects/[id]" options={{ title: 'Project' }} />
          <Stack.Screen name="sandbox/builds/[id]" options={{ title: 'Build' }} />
          <Stack.Screen name="sandbox/agent/[id]" options={{ title: 'Claude run' }} />
          <Stack.Screen name="sandbox/claude" options={{ title: 'Claude account' }} />
          <Stack.Screen name="inbox" options={{ title: 'Inbox' }} />
          <Stack.Screen name="files" options={{ title: 'Files' }} />
          <Stack.Screen name="chats/index" options={{ title: 'Chats' }} />
          <Stack.Screen name="chats/[id]" options={{ title: 'Continue chat' }} />
          <Stack.Screen name="analytics/index" options={{ title: 'Analytics' }} />
          <Stack.Screen name="analytics/projects/[id]" options={{ title: 'Project usage' }} />
          <Stack.Screen name="island/[action]" options={{ animation: 'none', title: 'Island' }} />
          <Stack.Screen name="island/run/[id]" options={{ animation: 'none', title: 'Island' }} />
        </Stack.Protected>
        <Stack.Protected guard={!paired}>
          <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Screen name="pair" options={{ presentation: 'modal', title: 'Pair a sandbox' }} />
      </Stack>
      {paired ? <InboxNotifier /> : null}
      {paired ? <IslandHost /> : null}
    </ThemeProvider>
  );
}

function RootLayout() {
  usePortraitLock();
  useMonitoredNavigation();

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

export default withMonitoring(RootLayout);
