import { useMemo } from "react";
import { router, type Href } from "expo-router";

import { FILE_DOWNLOAD_PARAM, FILES_ROUTE } from "@/features/files/utils/constants";

import type { PairingPrefill, TerminalLaunch } from "../types";
import { useSandboxScopeId } from "./sandbox-scope";

export function useSandboxNavigation() {
  const scopeId = useSandboxScopeId();
  return useMemo(() => {
    const on = scopeId ? { on: scopeId } : {};
    return {
      pair: () => router.push("/pair"),
      repair: (prefill: PairingPrefill) => router.push({ pathname: "/pair", params: prefill }),
      display: () => router.push("/sandbox/display"),
      preview: (sandboxId: string, runId: string, title: string) =>
        router.push({ pathname: "/sandbox/preview", params: { sandbox: sandboxId, run: runId, title } }),
      claudeAccount: () => router.push("/sandbox/claude"),
      activity: () => router.push("/sandbox/activity"),
      voice: () => router.push("/settings/voice"),
      about: () => router.push("/settings/about"),
      files: (downloadId?: string) =>
        router.push(
          (downloadId ? { pathname: FILES_ROUTE, params: { [FILE_DOWNLOAD_PARAM]: downloadId } } : FILES_ROUTE) as Href,
        ),
      project: (id: string, processId?: string) =>
        router.push({ pathname: "/sandbox/projects/[id]", params: processId ? { id, process: processId } : { id } }),
      projectFiles: (id: string) => router.push({ pathname: "/sandbox/files/[id]", params: { id } }),
      newProject: () => router.push("/sandbox/projects/new"),
      replaceWithProject: (id: string) => router.replace({ pathname: "/sandbox/projects/[id]", params: { id } }),
      build: (id: string) => router.push({ pathname: "/sandbox/builds/[id]", params: { id } }),
      agentRun: (id: string) => router.push({ pathname: "/sandbox/agent/[id]", params: { id, ...on } }),
      newAgentRun: (projectId?: string) =>
        router.push({ pathname: "/sandbox/agent/[id]", params: projectId ? { id: "new", projectId, ...on } : { id: "new", ...on } }),
      terminal: (id: string) => router.push({ pathname: "/sandbox/terminal/[id]", params: { id, ...on } }),
      newTerminal: ({ kind, projectId }: TerminalLaunch) =>
        router.push({
          pathname: "/sandbox/terminal/[id]",
          params: projectId ? { id: "new", kind, projectId, ...on } : { id: "new", kind, ...on },
        }),
      replaceWithTerminal: (id: string) => router.replace({ pathname: "/sandbox/terminal/[id]", params: { id, ...on } }),
      replaceWithAgentRun: (id: string) => router.replace({ pathname: "/sandbox/agent/[id]", params: { id, ...on } }),
      back: () => (router.canGoBack() ? router.back() : router.replace("/agents")),
      sandboxHub: () => router.navigate("/agents"),
      hub: () => (router.canGoBack() ? router.dismissTo("/agents") : router.replace("/agents")),
    };
  }, [scopeId]);
}
