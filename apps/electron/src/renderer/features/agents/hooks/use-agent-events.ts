import { useServerEvent } from "../../../app/connection";
import { useAgentsUi } from "../store";
import { useRefreshDetails } from "./use-agent-details";
import { useRunsCache } from "./use-runs-cache";

export function useAgentEvents(): void {
  const cache = useRunsCache();
  const refreshDetails = useRefreshDetails();

  useServerEvent("agent.updated", (event) => cache.upsert(event.run));
  useServerEvent("agent.deleted", (event) => {
    cache.remove(event.ids);
    const { selectedRunId, closeDetail } = useAgentsUi.getState();
    if (selectedRunId && event.ids.includes(selectedRunId)) closeDetail();
  });
  useServerEvent("inbox.updated", () => refreshDetails());
  useServerEvent("hello", () => {
    refreshDetails();
    if (useAgentsUi.getState().filter === "archived") cache.refreshArchived();
  });
}
