import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ConnectionState } from "@theone/client";
import type { LogLine } from "@theone/protocol";

import { storeBuild } from "../api/cache";
import { RESUMABLE_STREAM_OPTIONS, createReconnectGuard } from "../api/streams";
import type { LogSource } from "../types";
import { mergeBySeq } from "../utils/collections";
import { LOG_BUFFER_LIMIT } from "../utils/constants";
import { describeError } from "../utils/errors";
import { useSandboxClient } from "./use-sandbox-client";
import { useStreamBuffer } from "./use-stream-buffer";

type StreamMeta = {
  key: string;
  state: ConnectionState;
  exitCode: number | null | undefined;
  error: string | null;
};

export type LogStream = {
  lines: LogLine[];
  state: ConnectionState | "idle";
  exitCode: number | null | undefined;
  error: string | null;
  reconnect: () => void;
};

const mergeLines = (current: LogLine[], incoming: LogLine[]) => mergeBySeq(current, incoming, LOG_BUFFER_LIMIT);

export function useLogStream(source: LogSource | null): LogStream {
  const { sandbox, client } = useSandboxClient();
  const queryClient = useQueryClient();
  const [generation, setGeneration] = useState(0);
  const sourceKey = source ? `${sandbox?.id ?? ""}:${source.kind}:${source.id}` : "";
  const connectionKey = `${sourceKey}#${generation}`;
  const { items, push } = useStreamBuffer<LogLine>(sourceKey, mergeLines);
  const [meta, setMeta] = useState<StreamMeta | null>(null);
  const sandboxId = sandbox?.id ?? null;
  const kind = source?.kind ?? null;
  const id = source?.id ?? null;

  useEffect(() => {
    if (!client || !sandboxId || !kind || !id) return;
    const update = (patch: Partial<StreamMeta>) =>
      setMeta((current) => ({
        ...(current?.key === connectionKey ? current : { key: connectionKey, state: "connecting", exitCode: undefined, error: null }),
        ...patch,
      }));
    const guard = createReconnectGuard();
    const handlers = {
      onLine: (line: LogLine) => push(sourceKey, [line]),
      onExit: (code: number | null) => update({ exitCode: code }),
      onStateChange: (state: ConnectionState) => {
        guard.onStateChange(state);
        update(state === "open" ? { state, error: null } : { state });
      },
      onError: (error: unknown) => update({ error: describeError(error) }),
      onClose: guard.onClose,
    };
    const connection = guard.attach(
      kind === "build"
        ? client.openBuildLogs(
            id,
            { ...handlers, onBuild: (build) => storeBuild(queryClient, sandboxId, build) },
            RESUMABLE_STREAM_OPTIONS,
          )
        : client.openProcessLogs(id, handlers, RESUMABLE_STREAM_OPTIONS),
    );
    return () => connection.close();
  }, [client, sandboxId, kind, id, sourceKey, connectionKey, push, queryClient]);

  const reconnect = useCallback(() => setGeneration((value) => value + 1), []);
  const current = meta?.key === connectionKey ? meta : null;

  return {
    lines: items,
    state: source && client ? (current?.state ?? "connecting") : "idle",
    exitCode: current?.exitCode,
    error: current?.error ?? null,
    reconnect,
  };
}
