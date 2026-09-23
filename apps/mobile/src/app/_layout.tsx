import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Per-weight entry points on purpose: the package barrel pulls in all eighteen
// Saira faces, and we ship four.
import { Saira_400Regular } from '@expo-google-fonts/saira/400Regular';
import { Saira_500Medium } from '@expo-google-fonts/saira/500Medium';
import { Saira_600SemiBold } from '@expo-google-fonts/saira/600SemiBold';
import { Saira_700Bold } from '@expo-google-fonts/saira/700Bold';

import { useColorScheme } from '@/hooks/use-color-scheme';
import AppProviders from '@/providers/app-providers';

// Held until Saira is registered, so no frame renders in the fallback face.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Saira_400Regular,
    Saira_500Medium,
    Saira_600SemiBold,
    Saira_700Bold,
  });

  useEffect(() => {
    // A font failure is not worth a permanent splash — show the UI regardless.
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AppProviders>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="pair" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sandbox/display" options={{ gestureEnabled: false }} />
        <Stack.Screen name="sandbox/terminal/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="sandbox/projects/new" />
        <Stack.Screen name="sandbox/projects/[id]" />
        <Stack.Screen name="sandbox/builds/[id]" />
        <Stack.Screen name="sandbox/agent/[id]" />
      </Stack>
    </ThemeProvider>
    </AppProviders>
  );
}
