import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ConnectionState } from "@theone/client";
import type { AgentRun, AgentRunEvent } from "@theone/protocol";

import { storeAgentRun } from "../api/cache";
import { RESUMABLE_STREAM_OPTIONS, createReconnectGuard } from "../api/streams";
import { mergeBySeq } from "../utils/collections";
import { AGENT_EVENT_LIMIT } from "../utils/constants";
import { describeError } from "../utils/errors";
import { useSandboxClient } from "./use-sandbox-client";
import { useAgentRun } from "./use-sandbox-queries";
import { useStreamBuffer } from "./use-stream-buffer";

type StreamMeta = { key: string; state: ConnectionState; error: string | null };

export type AgentRunStream = {
  run: AgentRun | undefined;
  events: AgentRunEvent[];
  state: ConnectionState | "idle";
  error: string | null;
  loadError: Error | null;
  isLoading: boolean;
  reconnect: () => void;
};

const mergeEvents = (current: AgentRunEvent[], incoming: AgentRunEvent[]) => mergeBySeq(current, incoming, AGENT_EVENT_LIMIT);

export function useAgentRunStream(runId: string): AgentRunStream {
  const { sandbox, client } = useSandboxClient();
  const queryClient = useQueryClient();
  const detail = useAgentRun(runId);
  const [generation, setGeneration] = useState(0);
  const sandboxId = sandbox?.id ?? null;
  const streamKey = `${sandboxId ?? ""}:${runId}`;
  const connectionKey = `${streamKey}#${generation}`;
  const { items, push } = useStreamBuffer<AgentRunEvent>(streamKey, mergeEvents);
  const [meta, setMeta] = useState<StreamMeta | null>(null);

  useEffect(() => {
    if (!client || !sandboxId || !runId) return;
    const update = (patch: Partial<StreamMeta>) =>
      setMeta((current) => ({
        ...(current?.key === connectionKey ? current : { key: connectionKey, state: "connecting", error: null }),
        ...patch,
      }));
    const guard = createReconnectGuard();
    const connection = guard.attach(
      client.openAgentRun(
        runId,
        {
          onEvent: (event) => push(streamKey, [event]),
          onRun: (run) => storeAgentRun(queryClient, sandboxId, run),
          onStateChange: (state) => {
            guard.onStateChange(state);
            update(state === "open" ? { state, error: null } : { state });
          },
          onError: (error) => update({ error: describeError(error) }),
          onClose: guard.onClose,
        },
        RESUMABLE_STREAM_OPTIONS,
      ),
    );
    return () => connection.close();
  }, [client, sandboxId, runId, streamKey, connectionKey, push, queryClient]);

  const reconnect = useCallback(() => setGeneration((value) => value + 1), []);
  const current = meta?.key === connectionKey ? meta : null;
  const baseEvents = detail.data?.events;
  const events = useMemo(() => mergeEvents(baseEvents ?? [], items), [baseEvents, items]);

  return {
    run: detail.data,
    events,
    state: client ? (current?.state ?? "connecting") : "idle",
    error: current?.error ?? null,
    loadError: detail.error,
    isLoading: detail.isLoading,
    reconnect,
  };
}
