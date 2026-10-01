import { Stack } from "expo-router";

export const unstable_settings = { initialRouteName: "welcome" };

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="setup" />
    </Stack>
  );
}
