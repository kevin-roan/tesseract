import { useLocalSearchParams } from "expo-router";

import AgentRunView from "@/features/sandbox/components/agent-run-view";
import NewAgentRunView from "@/features/sandbox/components/new-agent-run-view";
import { firstParam, isNewRoute, projectIdParam } from "@/features/sandbox/utils/routes";

export default function AgentRunScreen() {
  const params = useLocalSearchParams<{ id: string; projectId?: string }>();

  return isNewRoute(params.id) ? (
    <NewAgentRunView projectId={projectIdParam(params.projectId)} />
  ) : (
    <AgentRunView runId={firstParam(params.id) ?? ""} />
  );
}
