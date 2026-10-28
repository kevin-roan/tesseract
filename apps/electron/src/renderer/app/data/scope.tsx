import type { TesseractClient } from "@tesseract/client";
import { createContext, useContext, type ReactNode } from "react";

const ScopedClient = createContext<TesseractClient | null>(null);

/** Points `useApiClient` / `useApiQuery` below it at another controller (e.g. the host workspace) instead of the active connection. */
export function ApiClientScope({ client, children }: { client: TesseractClient; children: ReactNode }) {
  return <ScopedClient.Provider value={client}>{children}</ScopedClient.Provider>;
}

export function useScopedClient(): TesseractClient | null {
  return useContext(ScopedClient);
}
