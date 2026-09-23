import { HammerIcon } from "phosphor-react-native";
import { isFinalBuildState, type BuildJob } from "@theone/protocol";

import ProgressBar from "@/components/progress-bar";
import ResourceCard from "@/components/resource-card";

import { buildMeta, buildSubtitle } from "../../utils/describe";
import { buildTargetLabel } from "../../utils/labels";
import { buildTone, stateLabel } from "../../utils/states";

export type BuildCardProps = {
  build: BuildJob;
  onPress?: () => void;
};

const BuildCard = ({ build, onPress }: BuildCardProps) => (
  <ResourceCard
    icon={HammerIcon}
    title={buildTargetLabel(build.target)}
    subtitle={buildSubtitle(build)}
    meta={buildMeta(build)}
    badge={{ label: stateLabel(build.state), tone: buildTone(build.state) }}
    onPress={onPress}
  >
    {isFinalBuildState(build.state) ? null : (
      <ProgressBar progress={build.progress} tone={buildTone(build.state)} label="Build progress" />
    )}
  </ResourceCard>
);

export default BuildCard;
