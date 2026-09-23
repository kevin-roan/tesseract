import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TheOneClient } from "@theone/client";

import { originOf } from "@/lib/url";

import { sandboxKeys } from "../api/query-keys";
import type { PageKind } from "../types";
import { useSandboxClient } from "./use-sandbox-client";

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
  build: (client: TheOneClient) => Promise<string>,
  enabled = true,
): PageUrl {
  const { sandbox, client } = useSandboxClient();
  const queryClient = useQueryClient();
  const sandboxId = sandbox?.id ?? null;
  const query = useQuery({
    queryKey: sandboxId ? sandboxKeys.page(sandboxId, page, id) : sandboxKeys.root,
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

  useEffect(() => {
    if (enabled || !sandboxId) return;
    void queryClient.resetQueries({ queryKey: sandboxKeys.page(sandboxId, page, id), exact: true });
  }, [enabled, queryClient, sandboxId, page, id]);

  return {
    url: enabled ? (query.data ?? null) : null,
    origin: sandbox ? originOf(sandbox.baseUrl) : null,
    error: query.error,
    isLoading: query.isLoading,
    refresh,
  };
}
