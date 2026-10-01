import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { sandboxKeys } from "../api/query-keys";
import { useActiveSandbox } from "./use-sandbox-client";

export function useSandboxRefresh() {
  const queryClient = useQueryClient();
  const sandbox = useActiveSandbox();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!sandbox) return;
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({
        queryKey: sandboxKeys.all(sandbox.id),
        type: "active",
        predicate: (query) => query.queryKey[2] !== "page" && query.queryKey[2] !== "activity",
      });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, sandbox]);

  return { refreshing, refresh: () => void refresh() };
}
