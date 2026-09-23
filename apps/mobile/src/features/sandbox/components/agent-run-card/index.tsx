import { SparkleIcon } from "phosphor-react-native";
import type { AgentRun } from "@theone/protocol";

import ResourceCard from "@/components/resource-card";

import { agentRunMeta } from "../../utils/describe";
import { agentRunTone, stateLabel } from "../../utils/states";

export type AgentRunCardProps = {
  run: AgentRun;
  onPress?: () => void;
};

const AgentRunCard = ({ run, onPress }: AgentRunCardProps) => (
  <ResourceCard
    icon={SparkleIcon}
    title={run.prompt}
    subtitle={run.result ?? run.error ?? undefined}
    meta={agentRunMeta(run)}
    badge={{ label: stateLabel(run.state), tone: agentRunTone(run.state) }}
    onPress={onPress}
  />
);

export default AgentRunCard;
