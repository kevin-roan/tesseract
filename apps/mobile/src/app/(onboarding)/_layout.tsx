import { Stack } from "expo-router";

import { useAppTheme } from "@/hooks/use-app-theme";

export const unstable_settings = { initialRouteName: "welcome" };

export default function OnboardingLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="setup" />
    </Stack>
  );
}
