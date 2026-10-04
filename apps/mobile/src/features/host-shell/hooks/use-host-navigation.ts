import { useMemo } from "react";
import { router } from "expo-router";

export function useHostNavigation() {
  return useMemo(
    () => ({
      open: () => router.push("/host"),
      terminal: (id: string) => router.push({ pathname: "/host/terminal/[id]", params: { id } }),
      back: () => (router.canGoBack() ? router.back() : router.replace("/profile")),
      lockScreen: () => (router.canGoBack() ? router.back() : router.replace("/host")),
      setup: () => router.replace("/host"),
    }),
    [],
  );
}
