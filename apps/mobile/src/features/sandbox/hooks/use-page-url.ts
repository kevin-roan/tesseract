import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TesseractClient } from "@tesseract/client";

import { originOf } from "@/lib/url";

import { sandboxKeys } from "../api/query-keys";
import type { PageKind } from "../types";
import { useSandboxClient } from "./use-sandbox-client";

export type PageTarget = {
  key: readonly unknown[];
  client: TesseractClient | null;
  origin: string | null;
};

export type PageUrl = {
  url: string | null;
  origin: string | null;
  error: Error | null;
  isLoading: boolean;
  refresh: () => void;
};

export function usePageUrl(
  page: PageKind,
  id: string | null,
  build: (client: TesseractClient) => Promise<string>,
  enabled = true,
  target?: PageTarget,
): PageUrl {
  const active = useSandboxClient();
  const queryClient = useQueryClient();
  const sandboxId = active.sandbox?.id ?? null;
  const client = target ? target.client : active.client;
  const pageKey = target?.key ?? (sandboxId ? sandboxKeys.page(sandboxId, page, id) : null);
  const query = useQuery({
    queryKey: pageKey ?? sandboxKeys.root,
    queryFn: () => {
      if (!client) throw new Error("No sandbox is paired.");
      return build(client);
    },
    enabled: enabled && client !== null,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
  const { refetch } = query;
  const refresh = useCallback(() => void refetch(), [refetch]);

  const resetKey = pageKey ? JSON.stringify(pageKey) : null;
  useEffect(() => {
    if (enabled || !resetKey) return;
    void queryClient.resetQueries({ queryKey: JSON.parse(resetKey) as unknown[], exact: true });
  }, [enabled, queryClient, resetKey]);

  return {
    url: enabled ? (query.data ?? null) : null,
    origin: target ? target.origin : active.sandbox ? originOf(active.sandbox.baseUrl) : null,
    error: query.error,
    isLoading: query.isLoading,
    refresh,
  };
}
