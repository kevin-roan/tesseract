import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { HostShellState } from "../../../../shared/contracts/hostShell";
import { ipc } from "../../../lib/ipc";
import { HOST_SHELL_STATE_KEY } from "../constants";

export interface HostShellStateOptions {
  refetchOnMount?: boolean;
}

export function useHostShellState({ refetchOnMount = false }: HostShellStateOptions = {}): HostShellState | null {
  const queryClient = useQueryClient();
  useEffect(() => ipc.hostShell.on("state", (state) => queryClient.setQueryData(HOST_SHELL_STATE_KEY, state)), [queryClient]);
  const query = useQuery({
    queryKey: HOST_SHELL_STATE_KEY,
    queryFn: () => ipc.hostShell.state(),
    staleTime: Infinity,
    refetchOnMount: refetchOnMount ? "always" : true,
    retry: false,
  });
  return query.data ?? null;
}
