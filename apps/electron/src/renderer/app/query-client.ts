import { QueryClient } from "@tanstack/react-query";

export const QUERY_DEFAULTS = { staleTimeMs: 5_000, gcTimeMs: 5 * 60_000 } as const;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_DEFAULTS.staleTimeMs,
        gcTime: QUERY_DEFAULTS.gcTimeMs,
        retry: false,
        refetchOnWindowFocus: false,
        structuralSharing: true,
      },
      mutations: { retry: false },
    },
  });
}
