import { createContext, useContext, type ReactNode } from "react";

const ScopedSandbox = createContext<string | null>(null);

/** Screens below talk to the paired sandbox `id` (e.g. the host workspace) instead of the active one; `null` keeps the active one. */
export function SandboxScope({ id, children }: { id: string | null | undefined; children: ReactNode }) {
  return <ScopedSandbox.Provider value={id ?? null}>{children}</ScopedSandbox.Provider>;
}

export function useSandboxScopeId(): string | null {
  return useContext(ScopedSandbox);
}
