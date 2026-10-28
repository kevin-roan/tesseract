import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { HostWorkspaceAccess } from "@tesseract/protocol";

import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { hostKeys } from "../api/query-keys";
import { selectWorkspaceId, useHostStore } from "../store/host-store";
import { isSameWorkspace } from "../utils/workspace";
import { useHostClient } from "./use-host-client";

async function connectWorkspace(sandboxId: string, access: HostWorkspaceAccess): Promise<void> {
  const sandboxes = useSandboxStore.getState();
  const linked = selectWorkspaceId(useHostStore.getState(), sandboxId);
  const current = sandboxes.sandboxes.find((entry) => entry.id === linked);
  if (isSameWorkspace(current, linked ? sandboxes.tokens[linked] : undefined, access)) return;
  const workspace = await sandboxes.addSandbox({ name: access.name, baseUrl: access.url, token: access.token }, { activate: false });
  useHostStore.getState().linkWorkspace(sandboxId, workspace.id);
}

/** While the host shell is unlocked, pairs its host workspace controller (once per session) so projects can run on the host. */
export function useHostWorkspaceSync(): void {
  const { host, session, sessionClient } = useHostClient();
  const sandboxId = useSandboxStore((state) => state.activeId);
  const workspace = useQuery({
    queryKey: hostKeys.workspace(host?.baseUrl ?? "", session?.session ?? ""),
    queryFn: ({ signal }) => {
      if (!sessionClient) throw new Error("The host shell is locked.");
      return sessionClient.hostWorkspace({ signal });
    },
    enabled: sessionClient !== null,
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!workspace.data || !sandboxId) return;
    void connectWorkspace(sandboxId, workspace.data).catch(() => undefined);
  }, [workspace.data, sandboxId]);
}
