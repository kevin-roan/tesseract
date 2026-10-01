import { useMemo } from "react";
import { router } from "expo-router";

export function useOnboardingNavigation() {
  return useMemo(
    () => ({
      setup: () => router.push("/setup"),
      pair: () => router.push("/pair"),
      back: () => (router.canGoBack() ? router.back() : router.replace("/welcome")),
    }),
    [],
  );
}
