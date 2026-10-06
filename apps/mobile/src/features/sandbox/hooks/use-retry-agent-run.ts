import { useCallback } from "react";
import type { AgentRun } from "@theone/protocol";

import { describeError } from "../utils/errors";
import { useStartAgentRun } from "./use-sandbox-mutations";

/** Sends a failed run's prompt, attachments and mode again, in the same session when it has one. */
export function useRetryAgentRun(run: AgentRun | undefined, onStarted: (run: AgentRun) => void) {
  const start = useStartAgentRun();
  const { mutate } = start;

  const retry = useCallback(() => {
    if (!run) return;
    mutate(
      {
        prompt: run.prompt,
        ...(run.mode ? { mode: run.mode } : {}),
        ...(run.projectId ? { projectId: run.projectId } : {}),
        ...(run.attachments.length > 0 ? { attachmentIds: run.attachments.map((upload) => upload.id) } : {}),
        ...(run.sessionId ? { resumeSessionId: run.sessionId } : {}),
      },
      { onSuccess: onStarted },
    );
  }, [run, mutate, onStarted]);

  return {
    canRetry: run?.state === "failed",
    retry,
    retrying: start.isPending,
    error: start.error ? describeError(start.error) : null,
  };
}
