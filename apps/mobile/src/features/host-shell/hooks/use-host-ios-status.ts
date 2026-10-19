import { useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { isApiError } from "@tesseract/client";

import { hostKeys } from "../api/query-keys";
import { useHostSessionStore } from "../store/host-session-store";
import { HOST_LOCKED } from "../utils/content";
import { isSessionLost } from "../utils/errors";
import { iosPollInterval } from "../utils/ios";
import { useHostClient } from "./use-host-client";

export function useHostIosStatus(enabled = true) {
  const { host, session, sessionClient } = useHostClient();
  const clear = useHostSessionStore((state) => state.clear);
  const key = host && session ? hostKeys.ios(host.baseUrl, session.session) : hostKeys.root;

  const status = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.hostIosStatus({ signal });
    },
    enabled: enabled && sessionClient !== null,
    refetchInterval: (query) => iosPollInterval(query.state.data),
  });

  const dropOnLost = useCallback(
    (error: unknown) => {
      if (isSessionLost(error)) clear();
    },
    [clear],
  );

  useEffect(() => dropOnLost(status.error), [status.error, dropOnLost]);

  return { status, key, sessionClient, dropOnLost, supported: !isApiError(status.error, "not_found") };
}
