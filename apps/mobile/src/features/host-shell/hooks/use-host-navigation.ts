import { useMemo } from "react";
import { router } from "expo-router";

import type { HostScreenTarget } from "../types";
import { HOST_DEVICES } from "../utils/devices";

function showScreen(navigate: typeof router.push, { kind, serial }: HostScreenTarget) {
  const spec = HOST_DEVICES[kind];
  if (!spec) return;
  if (serial) navigate({ pathname: spec.route, params: { serial } });
  else navigate(spec.route);
}

export function useHostNavigation() {
  return useMemo(
    () => ({
      open: () => router.push("/host"),
      terminal: (id: string) => router.push({ pathname: "/host/terminal/[id]", params: { id } }),
      screen: (target: HostScreenTarget) => showScreen(router.push, target),
      stream: () => router.push("/host/stream"),
      replaceWithScreen: (target: HostScreenTarget) => showScreen(router.replace, target),
      unlockForScreen: ({ kind, serial }: HostScreenTarget) =>
        router.replace({ pathname: "/host", params: serial ? { next: kind, serial } : { next: kind } }),
      back: () => (router.canGoBack() ? router.back() : router.replace("/profile")),
      lockScreen: () => (router.canGoBack() ? router.back() : router.replace("/host")),
    }),
    [],
  );
}
