import { useCallback } from "react";
import { BuildIdSchema, ProcessIdSchema } from "@tesseract/protocol";

import { useCancelAgentRun, useCancelBuild, useStopProcess } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";

import { takeSharedItems, type IslandAction, type SharedItem } from "@/modules/tesseract-island";

import { useIslandStore } from "../store/island-store";
import { seedFromSharedItems } from "../utils/shared";

export function useIslandDispatch() {
  const nav = useSandboxNavigation();
  const cancelRun = useCancelAgentRun();
  const { mutate: cancel } = cancelRun;
  const { mutate: cancelBuild } = useCancelBuild();
  const { mutate: stopProcess } = useStopProcess();
  const openCapture = useIslandStore((state) => state.openCapture);
  const openAttach = useIslandStore((state) => state.openAttach);
  const queueSharedItems = useIslandStore((state) => state.queueSharedItems);
  const takeQueuedItems = useIslandStore((state) => state.takeSharedItems);

  const attachShared = useCallback(
    (items: SharedItem[]) => {
      const flow = seedFromSharedItems(items);
      if (!flow) return;
      if ("seed" in flow) openCapture(flow.seed);
      else openAttach(flow.draft);
    },
    [openCapture, openAttach],
  );

  const collectShared = useCallback(async () => {
    const fresh = await takeSharedItems().catch(() => []);
    queueSharedItems(fresh);
    return fresh.length;
  }, [queueSharedItems]);

  const attachQueuedShared = useCallback(() => attachShared(takeQueuedItems()), [attachShared, takeQueuedItems]);

  const dispatch = useCallback(
    async (action: IslandAction) => {
      switch (action.action) {
        case "stop":
          if (!action.runId) return;
          if (ProcessIdSchema.safeParse(action.runId).success) stopProcess(action.runId);
          else if (BuildIdSchema.safeParse(action.runId).success) cancelBuild(action.runId);
          else cancel(action.runId);
          return;
        case "open":
          if (action.runId) nav.agentRun(action.runId);
          else nav.sandboxHub();
          return;
        case "capture":
          openCapture();
          return;
        case "share":
          await collectShared();
          attachQueuedShared();
          return;
      }
    },
    [cancel, cancelBuild, stopProcess, nav, openCapture, collectShared, attachQueuedShared],
  );

  return { dispatch, collectShared, attachQueuedShared };
}
