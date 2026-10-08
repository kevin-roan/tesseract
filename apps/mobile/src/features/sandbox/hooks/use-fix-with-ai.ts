import { useCallback, useState } from "react";
import type { TesseractClient } from "@tesseract/client";
import type { AppRun, BuildJob, LogLine, ProcessInfo } from "@tesseract/protocol";

import { useIslandStore } from "@/features/island/store/island-store";

import { describeError } from "../utils/errors";
import { FIX_LOG_TAIL, appRunFailure, buildFailure, failurePrompt, processFailure, type FailureContext } from "../utils/fix-prompt";
import { useSandboxClient } from "./use-sandbox-client";
import { useSandboxNavigation } from "./use-sandbox-navigation";

/**
 * Hands a failed run to the agent: fetches the tail of its log, drops it into a new chat's
 * composer for the run's project, and lets the user add context before sending.
 */
export function useFixWithAi() {
  const nav = useSandboxNavigation();
  const { client } = useSandboxClient();
  const setPendingDraft = useIslandStore((state) => state.setPendingDraft);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(
    async (
      id: string,
      projectId: string | null,
      fetchLines: (client: TesseractClient) => Promise<LogLine[]>,
      toContext: (lines: LogLine[]) => FailureContext,
    ) => {
      if (!client) return;
      setPendingId(id);
      setError(null);
      try {
        const lines = await fetchLines(client);
        setPendingDraft({ text: failurePrompt(toContext(lines)), files: [], source: "capture" });
        nav.newAgentRun(projectId ?? undefined);
      } catch (cause) {
        setError(describeError(cause));
      } finally {
        setPendingId(null);
      }
    },
    [client, nav, setPendingDraft],
  );

  const fixProcess = useCallback(
    (process: ProcessInfo) =>
      open(
        process.id,
        process.projectId,
        (api) => api.processLogs(process.id, { tail: FIX_LOG_TAIL }),
        (lines) => processFailure(process, lines),
      ),
    [open],
  );

  const fixBuild = useCallback(
    (build: BuildJob) =>
      open(
        build.id,
        build.projectId,
        (api) => api.buildLogs(build.id, { tail: FIX_LOG_TAIL }),
        (lines) => buildFailure(build, lines),
      ),
    [open],
  );

  const fixAppRun = useCallback(
    (run: AppRun, label: string) => {
      const processId = run.processIds[0];
      return open(
        run.id,
        run.projectId,
        async (api) => (processId ? api.processLogs(processId, { tail: FIX_LOG_TAIL }) : []),
        (lines) => appRunFailure(run, label, lines),
      );
    },
    [open],
  );

  return { fixProcess, fixBuild, fixAppRun, pendingId, error };
}
