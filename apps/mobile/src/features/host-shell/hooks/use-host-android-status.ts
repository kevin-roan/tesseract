import { useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { hostKeys } from "../api/query-keys";
import { useHostSessionStore } from "../store/host-session-store";
import { androidPollInterval } from "../utils/android";
import { HOST_LOCKED } from "../utils/content";
import { isSessionLost } from "../utils/errors";
import { useHostClient } from "./use-host-client";

export function useHostAndroidStatus(enabled = true) {
  const { host, session, sessionClient } = useHostClient();
  const clear = useHostSessionStore((state) => state.clear);
  const key = host && session ? hostKeys.android(host.baseUrl, session.session) : hostKeys.root;

  const status = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.hostAndroidStatus({ signal });
    },
    enabled: enabled && sessionClient !== null,
    refetchInterval: (query) => androidPollInterval(query.state.data),
  });

  const dropOnLost = useCallback(
    (error: unknown) => {
      if (isSessionLost(error)) clear();
    },
    [clear],
  );

  useEffect(() => dropOnLost(status.error), [status.error, dropOnLost]);

  return { status, key, sessionClient, dropOnLost };
}
