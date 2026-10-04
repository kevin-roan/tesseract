import { useCallback, useState } from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { Appearance } from 'react-native';

import { useAppReady } from '@/hooks/use-app-ready';
import { useNavigationTheme } from '@/hooks/use-navigation-theme';
import { usePortraitLock } from '@/hooks/use-orientation-lock';
import InboxNotifier from '@/features/inbox/components/inbox-notifier';
import IslandHost from '@/features/island/components/island-host';
import AppProviders from '@/providers/app-providers';
import SchemeScope from '@/components/scheme-scope';
import SplashOverlay from '@/components/splash-overlay';
import { initMonitoring, useMonitoredNavigation, withMonitoring } from '@/lib/monitoring';

initMonitoring();

// Graphite is a dark scheme: native chrome (alerts, keyboards, pickers, tab bar) must follow it, not the system setting.
Appearance.setColorScheme('dark');

// Held until the splash overlay has the same image on screen; the overlay then
// stays up until the fonts are registered and the paired sandboxes are known.
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const navigationTheme = useNavigationTheme();
  const { ready, paired } = useAppReady();
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  return (
    <>
      {ready ? (
        <ThemeProvider value={navigationTheme}>
          <Stack screenOptions={{ headerShown: false, orientation: 'portrait_up' }}>
            <Stack.Protected guard={paired}>
              <Stack.Screen name="(tabs)" options={{ animation: 'fade', title: 'Monolith' }} />
              <Stack.Screen name="sandbox/display" options={{ gestureEnabled: false, title: 'Display' }} />
              <Stack.Screen name="sandbox/preview" options={{ title: 'Preview' }} />
              <Stack.Screen name="sandbox/terminal/[id]" options={{ gestureEnabled: false, title: 'Terminal' }} />
              <Stack.Screen name="sandbox/projects/new" options={{ title: 'New project' }} />
              <Stack.Screen name="sandbox/projects/[id]" options={{ title: 'Project' }} />
              <Stack.Screen name="sandbox/builds/[id]" options={{ title: 'Build' }} />
              <Stack.Screen name="sandbox/agent/[id]" options={{ title: 'Claude run' }} />
              <Stack.Screen name="sandbox/claude" options={{ title: 'Claude accounts' }} />
              <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
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
            <Stack.Screen name="host/index" options={{ title: 'Host shell' }} />
            <Stack.Screen name="host/terminal/[id]" options={{ gestureEnabled: false, title: 'Host shell' }} />
            <Stack.Screen name="host/android" options={{ gestureEnabled: false, title: 'Android emulator' }} />
          </Stack>
          {paired ? <InboxNotifier /> : null}
          {paired ? <IslandHost /> : null}
        </ThemeProvider>
      ) : null}
      {splashDone ? null : <SplashOverlay ready={ready} title="Monolith" onDone={finishSplash} />}
    </>
  );
}

function RootLayout() {
  usePortraitLock();
  useMonitoredNavigation();

  return (
    <AppProviders>
      <SchemeScope scheme="graphite">
        <RootNavigator />
      </SchemeScope>
    </AppProviders>
  );
}

export default withMonitoring(RootLayout);
