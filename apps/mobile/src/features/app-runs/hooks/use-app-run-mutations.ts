import type { AppRunAction, StartAppRun } from "@theone/protocol";

import { useSandboxMutation } from "@/features/sandbox/hooks/use-sandbox-mutations";

import { storeAppRun } from "../api/cache";
import { appRunKeys } from "../api/query-keys";

export const useStartAppRun = () =>
  useSandboxMutation(
    (client, { projectId, ...body }: StartAppRun & { projectId: string }) => client.startAppRun(projectId, body),
    (queryClient, sandboxId, run) => {
      storeAppRun(queryClient, sandboxId, run);
      return queryClient.invalidateQueries({ queryKey: appRunKeys.lists(sandboxId) });
    },
  );

export const useStopAppRun = () =>
  useSandboxMutation(
    (client, runId: string) => client.stopAppRun(runId),
    (queryClient, sandboxId, run) => storeAppRun(queryClient, sandboxId, run),
  );

export const useAppRunAction = () =>
  useSandboxMutation(
    (client, { runId, action }: { runId: string; action: AppRunAction }) => client.appRunAction(runId, action),
    (queryClient, sandboxId, run) => storeAppRun(queryClient, sandboxId, run),
  );
