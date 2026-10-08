import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TerminalInfo } from "@tesseract/protocol";

import { TERMINAL_DEFAULT_SIZE } from "@/features/sandbox/utils/constants";

import { hostKeys } from "../api/query-keys";
import { useHostSessionStore } from "../store/host-session-store";
import { HOST_LOCKED } from "../utils/content";
import { isSessionLost } from "../utils/errors";
import { useHostClient } from "./use-host-client";

export function useHostTerminals() {
  const { host, session, sessionClient } = useHostClient();
  const clear = useHostSessionStore((state) => state.clear);
  const queryClient = useQueryClient();
  const key = host && session ? hostKeys.terminals(host.baseUrl, session.session) : hostKeys.root;

  const terminals = useQuery({
    queryKey: key,
    queryFn: () => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.listTerminals();
    },
    enabled: sessionClient !== null,
  });

  const dropOnLost = useCallback(
    (error: unknown) => {
      if (isSessionLost(error)) clear();
    },
    [clear],
  );

  useEffect(() => dropOnLost(terminals.error), [terminals.error, dropOnLost]);

  const replace = useCallback(
    (terminal: TerminalInfo) =>
      queryClient.setQueryData<TerminalInfo[]>(key, (list) => [terminal, ...(list ?? []).filter((entry) => entry.id !== terminal.id)]),
    [queryClient, key],
  );

  const create = useMutation({
    mutationFn: () => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.createTerminal({ kind: "shell", ...TERMINAL_DEFAULT_SIZE });
    },
    onSuccess: replace,
    onError: dropOnLost,
  });

  const close = useMutation({
    mutationFn: (id: string) => {
      if (!sessionClient) throw new Error(HOST_LOCKED);
      return sessionClient.closeTerminal(id);
    },
    onSuccess: replace,
    onError: dropOnLost,
  });

  return { terminals, create, close };
}
