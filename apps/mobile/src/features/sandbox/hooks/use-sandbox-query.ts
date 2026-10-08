import { useQuery, type QueryKey, type UseQueryResult } from "@tanstack/react-query";
import type { TesseractClient } from "@tesseract/client";
import { useIsFocused } from "expo-router";

import { sandboxKeys } from "../api/query-keys";
import { useSandboxClient } from "./use-sandbox-client";

export type SandboxQueryOptions = {
  enabled?: boolean;
  refetchInterval?: number;
};

export function useSandboxQuery<T>(
  key: (sandboxId: string) => QueryKey,
  fetcher: (client: TesseractClient, signal: AbortSignal) => Promise<T>,
  options: SandboxQueryOptions & { initialData?: (sandboxId: string) => T | undefined } = {},
): UseQueryResult<T, Error> {
  const { sandbox, client } = useSandboxClient();
  const focused = useIsFocused();
  const enabled = client !== null && (options.enabled ?? true);

  return useQuery({
    queryKey: sandbox ? key(sandbox.id) : sandboxKeys.root,
    queryFn: ({ signal }) => {
      if (!client) throw new Error("No sandbox is paired.");
      return fetcher(client, signal);
    },
    enabled,
    initialData: sandbox && options.initialData ? () => options.initialData?.(sandbox.id) : undefined,
    subscribed: focused,
    refetchInterval: focused && options.refetchInterval ? options.refetchInterval : false,
  });
}
