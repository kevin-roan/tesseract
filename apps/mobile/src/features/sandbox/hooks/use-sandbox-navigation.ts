import { useMemo } from "react";
import { router, type Href } from "expo-router";

import { FILE_DOWNLOAD_PARAM, FILES_ROUTE } from "@/features/files/utils/constants";

import type { PairingPrefill, TerminalLaunch } from "../types";

export function useSandboxNavigation() {
  return useMemo(
    () => ({
      pair: () => router.push("/pair"),
      repair: (prefill: PairingPrefill) => router.push({ pathname: "/pair", params: prefill }),
      display: () => router.push("/sandbox/display"),
      preview: (sandboxId: string, runId: string, title: string) =>
        router.push({ pathname: "/sandbox/preview", params: { sandbox: sandboxId, run: runId, title } }),
      claudeAccount: () => router.push("/sandbox/claude"),
      settings: () => router.push("/settings"),
      about: () => router.push("/settings/about"),
      files: (downloadId?: string) =>
        router.push(
          (downloadId ? { pathname: FILES_ROUTE, params: { [FILE_DOWNLOAD_PARAM]: downloadId } } : FILES_ROUTE) as Href,
        ),
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
      sandboxHub: () => router.navigate("/agents"),
      hub: () => (router.canGoBack() ? router.dismissTo("/agents") : router.replace("/agents")),
    }),
    [],
  );
}
