import { useMemo } from "react";
import { router } from "expo-router";

import type { PairingPrefill, TerminalLaunch } from "../types";

export function useSandboxNavigation() {
  return useMemo(
    () => ({
      pair: () => router.push("/pair"),
      repair: (prefill: PairingPrefill) => router.push({ pathname: "/pair", params: prefill }),
      display: () => router.push("/sandbox/display"),
      project: (id: string, processId?: string) =>
        router.push({ pathname: "/sandbox/projects/[id]", params: processId ? { id, process: processId } : { id } }),
      newProject: () => router.push("/sandbox/projects/new"),
      replaceWithProject: (id: string) => router.replace({ pathname: "/sandbox/projects/[id]", params: { id } }),
      build: (id: string) => router.push({ pathname: "/sandbox/builds/[id]", params: { id } }),
      agentRun: (id: string) => router.push({ pathname: "/sandbox/agent/[id]", params: { id } }),
      newAgentRun: (projectId?: string) =>
        router.push({ pathname: "/sandbox/agent/[id]", params: projectId ? { id: "new", projectId } : { id: "new" } }),
      terminal: (id: string) => router.push({ pathname: "/sandbox/terminal/[id]", params: { id } }),
      newTerminal: ({ kind, projectId }: TerminalLaunch) =>
        router.push({
          pathname: "/sandbox/terminal/[id]",
          params: projectId ? { id: "new", kind, projectId } : { id: "new", kind },
        }),
      replaceWithTerminal: (id: string) => router.replace({ pathname: "/sandbox/terminal/[id]", params: { id } }),
      replaceWithAgentRun: (id: string) => router.replace({ pathname: "/sandbox/agent/[id]", params: { id } }),
      back: () => (router.canGoBack() ? router.back() : router.replace("/agents")),
      hub: () => (router.canGoBack() ? router.dismissTo("/agents") : router.replace("/agents")),
    }),
    [],
  );
}
