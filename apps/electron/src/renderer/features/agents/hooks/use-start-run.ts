import type { AgentRun, StartAgentRun } from "@theone/protocol";
import { useCallback, useState } from "react";
import { describeError } from "../../../app/connection";
import { useApiClient } from "../../../app/data";
import { showToast } from "../../../components/Toast";
import { formatLabel, NEW_LABELS } from "../labels";
import { useAgentsUi } from "../store";
import { useRefreshDetails } from "./use-agent-details";
import { useRunsCache } from "./use-runs-cache";

let starting = false;

export function isStartingRun(): boolean {
  return starting;
}

export interface StartRunInput {
  prompt: string;
  projectId?: string | null;
  attachmentIds?: readonly string[];
  resumeSessionId?: string | null;
}

export function startRunBody({ prompt, projectId, attachmentIds, resumeSessionId }: StartRunInput): StartAgentRun {
  return {
    prompt,
    ...(projectId ? { projectId } : {}),
    ...(attachmentIds && attachmentIds.length ? { attachmentIds: [...attachmentIds] } : {}),
    ...(resumeSessionId ? { resumeSessionId } : {}),
  };
}

export function useStartRun() {
  const client = useApiClient();
  const cache = useRunsCache();
  const refreshDetails = useRefreshDetails();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (input: StartRunInput): Promise<AgentRun | null> => {
      if (starting || !client) return null;
      starting = true;
      setBusy(true);
      setError(null);
      try {
        const run = await client.startAgentRun(startRunBody(input));
        cache.upsert(run);
        const ui = useAgentsUi.getState();
        if (!input.resumeSessionId) ui.resetDraft();
        ui.select(run.id);
        refreshDetails();
        return run;
      } catch (failure) {
        const message = formatLabel(NEW_LABELS.failed, { error: describeError(failure) });
        setError(message);
        showToast(message);
        return null;
      } finally {
        starting = false;
        setBusy(false);
      }
    },
    [client, cache, refreshDetails],
  );

  return { start, busy, error, ready: client !== null, clearError: useCallback(() => setError(null), []) };
}
