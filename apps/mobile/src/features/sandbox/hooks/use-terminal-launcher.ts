import { useCallback, useEffect, useRef } from "react";
import type { TerminalInfo } from "@theone/protocol";

import type { TerminalLaunch } from "../types";
import { TERMINAL_DEFAULT_SIZE } from "../utils/constants";
import { describeError } from "../utils/errors";
import { useSandboxClient } from "./use-sandbox-client";
import { useCreateTerminal } from "./use-sandbox-mutations";

export function useTerminalLauncher(launch: TerminalLaunch | null, onCreated: (terminal: TerminalInfo) => void) {
  const { client } = useSandboxClient();
  const create = useCreateTerminal();
  const started = useRef(false);
  const kind = launch?.kind ?? null;
  const projectId = launch?.projectId;
  const { mutate } = create;

  const start = useCallback(() => {
    if (!kind) return;
    started.current = true;
    mutate({ kind, projectId, ...TERMINAL_DEFAULT_SIZE }, { onSuccess: onCreated });
  }, [kind, projectId, mutate, onCreated]);

  useEffect(() => {
    if (started.current || !client || !kind) return;
    start();
  }, [client, kind, start]);

  return {
    error: create.error ? describeError(create.error) : null,
    isCreating: create.isPending || (kind !== null && !create.isError && !create.isSuccess),
    retry: start,
  };
}
