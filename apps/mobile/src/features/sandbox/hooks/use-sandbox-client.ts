import { useMemo } from "react";
import type { TesseractClient } from "@tesseract/client";

import { getSandboxClient } from "../api/client";
import { selectActiveSandbox, selectActiveToken, useSandboxStore } from "../store/sandbox-store";
import type { PairedSandbox } from "../types";
import { useSandboxScopeId } from "./sandbox-scope";

export type SandboxClientState = {
  sandbox: PairedSandbox | null;
  client: TesseractClient | null;
  hydrated: boolean;
  missingToken: boolean;
};

export function useActiveSandbox(): PairedSandbox | null {
  return useSandboxStore(selectActiveSandbox);
}

export function useSandboxClient(): SandboxClientState {
  const scopeId = useSandboxScopeId();
  const active = useActiveSandbox();
  const activeToken = useSandboxStore(selectActiveToken);
  const scoped = useSandboxStore((state) => (scopeId ? (state.sandboxes.find((entry) => entry.id === scopeId) ?? null) : null));
  const scopedToken = useSandboxStore((state) => (scopeId ? (state.tokens[scopeId] ?? null) : null));
  const sandbox = scopeId ? scoped : active;
  const token = scopeId ? scopedToken : activeToken;
  const hydrated = useSandboxStore((state) => state.hydrated);
  const client = useMemo(() => (sandbox && token ? getSandboxClient(sandbox, token) : null), [sandbox, token]);
  return { sandbox, client, hydrated, missingToken: hydrated && sandbox !== null && token === null };
}
