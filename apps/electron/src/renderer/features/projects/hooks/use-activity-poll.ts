import type { BuildJob, ProcessInfo } from "@theone/protocol";
import { useCallback, useState } from "react";
import { useConnectionClient, useIsOnline, usePoller, useServerEvent, useWindowVisible } from "../../../app/connection";
import { LIST_ACTIVITY_INTERVAL_MS } from "../constants";
import { upsertById } from "../model";

interface Activity {
  processes: ProcessInfo[] | null;
  builds: BuildJob[] | null;
}

const EMPTY: Activity = { processes: null, builds: null };

export function useActivityPoll() {
  const client = useConnectionClient();
  const online = useIsOnline();
  const visible = useWindowVisible();
  const [activity, setActivity] = useState<Activity>(EMPTY);

  const fetch = useCallback(
    async (signal: AbortSignal): Promise<Activity> => {
      if (!client) return EMPTY;
      const [processes, builds] = await Promise.all([client.listProcesses(undefined, { signal }), client.listBuilds(undefined, { signal })]);
      return { processes, builds };
    },
    [client],
  );

  const poller = usePoller(fetch, LIST_ACTIVITY_INTERVAL_MS, {
    enabled: online && visible && client !== null,
    onResult: setActivity,
  });

  useServerEvent("process.updated", (event) =>
    setActivity((current) => (current.processes ? { ...current, processes: upsertById(current.processes, event.process) } : current)),
  );
  useServerEvent("build.updated", (event) =>
    setActivity((current) => (current.builds ? { ...current, builds: upsertById(current.builds, event.build) } : current)),
  );

  return { processes: activity.processes ?? NONE_PROCESSES, builds: activity.builds ?? NONE_BUILDS, refresh: poller.refresh };
}

const NONE_PROCESSES: ProcessInfo[] = [];
const NONE_BUILDS: BuildJob[] = [];
