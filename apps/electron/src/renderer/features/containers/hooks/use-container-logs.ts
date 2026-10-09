import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { ipc } from "../../../lib/ipc";
import { toLogLines } from "../../../onboarding/shell";
import { CONTAINERS_KEYS, CONTAINERS_POLL } from "../constants";

export function useContainerLogs(name: string, enabled: boolean) {
  const query = useQuery({
    queryKey: CONTAINERS_KEYS.logs(name),
    queryFn: () => ipc.containers.logs(name),
    refetchInterval: enabled ? CONTAINERS_POLL.logsMs : false,
    enabled,
  });
  const lines = useMemo(() => toLogLines(query.data ?? []), [query.data]);
  const { refetch } = query;
  const refresh = useCallback(() => void refetch(), [refetch]);
  return { lines, loading: query.isPending && enabled, error: query.error, refresh };
}
