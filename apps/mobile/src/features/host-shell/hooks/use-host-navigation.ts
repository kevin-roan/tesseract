import { useMemo } from "react";
import { router } from "expo-router";

import type { HostDeviceKind, HostScreenTarget } from "../types";
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
      projectChat: (projectId: string, workspaceId: string) =>
        router.push({ pathname: "/sandbox/agent/[id]", params: { id: "new", projectId, on: workspaceId } }),
      projectShell: (projectId: string, workspaceId: string) =>
        router.push({ pathname: "/sandbox/terminal/[id]", params: { id: "new", kind: "shell", projectId, on: workspaceId } }),
      terminal: (id: string) => router.push({ pathname: "/host/terminal/[id]", params: { id } }),
      screen: (target: HostScreenTarget) => showScreen(router.push, target),
      stream: (kind?: HostDeviceKind) =>
        kind === "ios" ? router.push({ pathname: "/host/stream", params: { kind } }) : router.push("/host/stream"),
      replaceWithScreen: (target: HostScreenTarget) => showScreen(router.replace, target),
      unlockForScreen: ({ kind, serial }: HostScreenTarget) =>
        router.replace({ pathname: "/host", params: serial ? { next: kind, serial } : { next: kind } }),
      back: () => (router.canGoBack() ? router.back() : router.replace("/profile")),
      lockScreen: () => (router.canGoBack() ? router.back() : router.replace("/host")),
    }),
    [],
  );
}
