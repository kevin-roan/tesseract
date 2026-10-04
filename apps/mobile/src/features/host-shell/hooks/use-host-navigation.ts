import { useMemo } from "react";
import { router } from "expo-router";

import { HOST_NEXT } from "../utils/constants";

export function useHostNavigation() {
  return useMemo(
    () => ({
      open: () => router.push("/host"),
      terminal: (id: string) => router.push({ pathname: "/host/terminal/[id]", params: { id } }),
      android: () => router.push("/host/android"),
      replaceWithAndroid: () => router.replace("/host/android"),
      unlockForAndroid: () => router.replace({ pathname: "/host", params: { next: HOST_NEXT.android } }),
      back: () => (router.canGoBack() ? router.back() : router.replace("/profile")),
      lockScreen: () => (router.canGoBack() ? router.back() : router.replace("/host")),
      setup: () => router.replace("/host"),
    }),
    [],
  );
}
