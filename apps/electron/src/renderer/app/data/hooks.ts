import { useQuery, useQueryClient, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";
import type { TesseractClient } from "@tesseract/client";
import { useEffect } from "react";
import type { ConnectionSnapshot } from "../../../shared/contracts/connection";
import { ipc } from "../../lib/ipc";
import { createApiClient } from "./client";

export const DATA_KEYS = {
  connection: ["connection", "snapshot"] as const,
  settings: ["app", "settings"] as const,
  api: (baseUrl: string, ...rest: unknown[]) => ["api", baseUrl, ...rest] as const,
};

export function useConnectionSnapshot() {
  const queryClient = useQueryClient();
  useEffect(
    () => ipc.connection.on("changed", (snapshot) => queryClient.setQueryData<ConnectionSnapshot>(DATA_KEYS.connection, snapshot)),
    [queryClient],
  );
  return useQuery({ queryKey: DATA_KEYS.connection, queryFn: () => ipc.connection.load(), staleTime: Infinity });
}

export function useApiClient(): TesseractClient | null {
  const config = useConnectionSnapshot().data?.config;
  return config ? createApiClient(config) : null;
}

type ApiQueryOptions<T> = Omit<UseQueryOptions<T, Error, T, QueryKey>, "queryKey" | "queryFn" | "enabled"> & {
  enabled?: boolean;
};

export function useApiQuery<T>(key: readonly unknown[], fetcher: (client: TesseractClient, signal: AbortSignal) => Promise<T>, options: ApiQueryOptions<T> = {}) {
  const client = useApiClient();
  const { enabled = true, ...rest } = options;
  return useQuery({
    ...rest,
    queryKey: DATA_KEYS.api(client?.baseUrl ?? "none", ...key),
    queryFn: ({ signal }) => {
      if (!client) throw new Error("Not connected");
      return fetcher(client, signal);
    },
    enabled: enabled && client !== null,
  });
}
