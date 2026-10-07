import { SparkleIcon } from "phosphor-react-native";
import type { AgentRun } from "@theone/protocol";

import ResourceCard from "@/components/resource-card";

import { agentRunMeta } from "../../utils/describe";
import { agentRunTone, stateLabel } from "../../utils/states";

export type AgentRunCardProps = {
  run: AgentRun;
  /** Display name of the run's project; the project id stands in when omitted. */
  projectName?: string | null;
  onPress?: () => void;
};

const AgentRunCard = ({ run, projectName, onPress }: AgentRunCardProps) => (
  <ResourceCard
    icon={SparkleIcon}
    title={run.prompt}
    subtitle={run.result ?? run.error ?? undefined}
    meta={agentRunMeta(run, projectName)}
    badge={{ label: stateLabel(run.state), tone: agentRunTone(run.state) }}
    onPress={onPress}
  />
);

export default AgentRunCard;
