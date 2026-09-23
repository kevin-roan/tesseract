import { useMemo } from "react";
import type { TheOneClient } from "@theone/client";

import { getSandboxClient } from "../api/client";
import { selectActiveSandbox, selectActiveToken, useSandboxStore } from "../store/sandbox-store";
import type { PairedSandbox } from "../types";

export type SandboxClientState = {
  sandbox: PairedSandbox | null;
  client: TheOneClient | null;
  hydrated: boolean;
  missingToken: boolean;
};

export function useActiveSandbox(): PairedSandbox | null {
  return useSandboxStore(selectActiveSandbox);
}

export function useSandboxClient(): SandboxClientState {
  const sandbox = useActiveSandbox();
  const token = useSandboxStore(selectActiveToken);
  const hydrated = useSandboxStore((state) => state.hydrated);
  const client = useMemo(() => (sandbox && token ? getSandboxClient(sandbox, token) : null), [sandbox, token]);
  return { sandbox, client, hydrated, missingToken: hydrated && sandbox !== null && token === null };
}
