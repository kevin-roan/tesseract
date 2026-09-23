import { useCallback, useMemo } from "react";
import { isFinalAgentRunState, type AgentRun } from "@theone/protocol";

import type { HeaderAction } from "@/components/screen-header";
import { confirm } from "@/lib/confirm";

import { PAGE_ACTIONS } from "../utils/actions";
import { describeError } from "../utils/errors";
import { formatCost } from "../utils/format";
import { agentRunTone, stateLabel } from "../utils/states";
import { useAgentComposer } from "./use-agent-composer";
import { useAgentRunStream } from "./use-agent-run-stream";
import { useCancelAgentRun } from "./use-sandbox-mutations";
import { useSandboxNavigation } from "./use-sandbox-navigation";

export function useAgentRunScreen(runId: string) {
  const nav = useSandboxNavigation();
  const stream = useAgentRunStream(runId);
  const cancelRun = useCancelAgentRun();
  const run = stream.run;
  const running = run ? !isFinalAgentRunState(run.state) : false;
  const { mutate } = cancelRun;
  const { reconnect } = stream;
  const onStarted = useCallback((next: AgentRun) => nav.replaceWithAgentRun(next.id), [nav]);
  const composer = useAgentComposer({
    defaultProjectId: run?.projectId ?? null,
    resumeSessionId: run?.sessionId ?? null,
    onStarted,
  });

  const cancel = useCallback(async () => {
    const confirmed = await confirm({
      title: "Stop Claude?",
      message: "The run is cancelled. Work already written to the project stays.",
      confirmLabel: "Stop run",
      cancelLabel: "Keep running",
      destructive: true,
    });
    if (confirmed) mutate(runId);
  }, [mutate, runId]);

  const headerActions = useMemo<HeaderAction[]>(
    () =>
      running
        ? [{ ...PAGE_ACTIONS.cancel, label: "Stop run", onPress: () => void cancel(), disabled: cancelRun.isPending }]
        : [{ ...PAGE_ACTIONS.reconnect, label: "Reload", onPress: reconnect }],
    [running, cancel, cancelRun.isPending, reconnect],
  );

  return {
    nav,
    run,
    events: stream.events,
    running,
    badge: run ? { label: stateLabel(run.state), tone: agentRunTone(run.state) } : undefined,
    cost: run ? formatCost(run.costUsd) : null,
    canContinue: Boolean(run && !running && run.sessionId),
    composer,
    headerActions,
    isLoading: stream.isLoading,
    loadError: stream.loadError ? describeError(stream.loadError) : null,
    streamError: stream.error,
    cancelError: cancelRun.error ? describeError(cancelRun.error) : null,
    retry: reconnect,
  };
}
