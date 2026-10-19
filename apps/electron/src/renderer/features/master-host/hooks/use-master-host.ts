import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import type { MasterHostState } from "../../../../shared/contracts/masterHost";
import { ipc } from "../../../lib/ipc";
import { MASTER_HOST_STATE_KEY } from "../constants";

export interface MasterHostActions {
  state: MasterHostState | null;
  link(link: string): Promise<void>;
  unlink(): Promise<void>;
  refresh(): void;
}

export function useMasterHost(): MasterHostActions {
  const queryClient = useQueryClient();
  useEffect(() => ipc.masterHost.on("state", (state) => queryClient.setQueryData(MASTER_HOST_STATE_KEY, state)), [queryClient]);
  const query = useQuery({
    queryKey: MASTER_HOST_STATE_KEY,
    queryFn: () => ipc.masterHost.state(),
    staleTime: Infinity,
    retry: false,
  });
  const { refetch } = query;

  const link = useCallback(
    async (value: string) => {
      queryClient.setQueryData(MASTER_HOST_STATE_KEY, await ipc.masterHost.link(value));
    },
    [queryClient],
  );
  const unlink = useCallback(async () => {
    queryClient.setQueryData(MASTER_HOST_STATE_KEY, await ipc.masterHost.unlink());
  }, [queryClient]);
  const refresh = useCallback(() => void refetch(), [refetch]);

  return { state: query.data ?? null, link, unlink, refresh };
}
