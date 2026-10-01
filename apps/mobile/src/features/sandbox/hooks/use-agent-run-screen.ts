import { useCallback, useMemo } from "react";
import { isFinalAgentRunState, type AgentRun } from "@theone/protocol";

import type { HeaderAction } from "@/components/screen-header";
import { useChatComposer } from "@/features/chat/hooks/use-chat-composer";
import { lastText, toChatEvents } from "@/features/chat/utils/messages";
import { confirm } from "@/lib/confirm";

import { PAGE_ACTIONS } from "../utils/actions";
import { describeError } from "../utils/errors";
import { elapsedSeconds, formatDuration, formatUsageBreakdown, formatUsageTokens } from "../utils/format";
import { agentRunTone, stateLabel } from "../utils/states";
import { useAgentRunStream } from "./use-agent-run-stream";
import { useCancelAgentRun } from "./use-sandbox-mutations";
import { useSandboxNavigation } from "./use-sandbox-navigation";
import { useSyncToHost } from "./use-sync-to-host";

/** One line under a finished run, e.g. "Succeeded in 2s · 142k tokens · 2 in · 22 out". */
export function runBrief(run: AgentRun): string {
  const seconds = elapsedSeconds(run.startedAt, run.endedAt);
  const outcome = seconds === null ? stateLabel(run.state) : `${stateLabel(run.state)} in ${formatDuration(seconds)}`;
  return [outcome, formatUsageTokens(run.usage), formatUsageBreakdown(run.usage)].filter(Boolean).join(" · ");
}

export function useAgentRunScreen(runId: string) {
  const nav = useSandboxNavigation();
  const stream = useAgentRunStream(runId);
  const cancelRun = useCancelAgentRun();
  const run = stream.run;
  const running = run ? !isFinalAgentRunState(run.state) : false;
  const { mutate } = cancelRun;
  const { reconnect } = stream;
  const syncToHost = useSyncToHost(run?.projectId ?? null, running);
  const syncAction = syncToHost.action;
  const onStarted = useCallback((next: AgentRun) => nav.replaceWithAgentRun(next.id), [nav]);
  const composer = useChatComposer({
    defaultProjectId: run?.projectId ?? null,
    resumeSessionId: run?.sessionId ?? null,
    defaultMode: run?.mode ?? null,
    onStarted,
  });
  const messages = useMemo(() => toChatEvents(stream.events), [stream.events]);
  const replyText = useMemo(() => lastText(stream.events)?.trim() ?? null, [stream.events]);
  /** The result usually is Claude's last reply, already in the list; only show it when it adds something. */
  const result = run?.result && run.result.trim() !== replyText ? run.result : null;

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

  const headerActions = useMemo<HeaderAction[]>(() => {
    const primary: HeaderAction = running
      ? { ...PAGE_ACTIONS.cancel, label: "Stop run", onPress: () => void cancel(), disabled: cancelRun.isPending }
      : { ...PAGE_ACTIONS.reconnect, label: "Reload", onPress: reconnect };
    return syncAction ? [primary, syncAction] : [primary];
  }, [running, cancel, cancelRun.isPending, reconnect, syncAction]);

  return {
    nav,
    run,
    events: stream.events,
    messages,
    running,
    badge: run ? { label: stateLabel(run.state), tone: agentRunTone(run.state) } : undefined,
    result,
    brief: run && !running ? runBrief(run) : null,
    canContinue: Boolean(run && !running && run.sessionId),
    composer,
    headerActions,
    isLoading: stream.isLoading,
    loadError: stream.loadError ? describeError(stream.loadError) : null,
    streamError: stream.error,
    cancelError: cancelRun.error ? describeError(cancelRun.error) : null,
    syncNotice: syncToHost.notice,
    dismissSyncNotice: syncToHost.dismiss,
    retry: reconnect,
  };
}
