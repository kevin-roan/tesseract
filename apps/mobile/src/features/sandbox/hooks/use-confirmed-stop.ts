import { useCallback } from "react";

import { confirm } from "@/lib/confirm";

import { useStopProcess } from "./use-sandbox-mutations";

export function useConfirmedStop() {
  const stopProcess = useStopProcess();
  const { mutate } = stopProcess;

  const stop = useCallback(
    async (id: string) => {
      const confirmed = await confirm({
        title: "Stop this process?",
        message: "It is shut down along with anything it serves. Run the script again to restart it.",
        confirmLabel: "Stop",
        cancelLabel: "Keep running",
        destructive: true,
      });
      if (confirmed) mutate(id);
    },
    [mutate],
  );

  return {
    stop: (id: string) => void stop(id),
    stoppingId: stopProcess.isPending ? stopProcess.variables : null,
    error: stopProcess.error,
  };
}
