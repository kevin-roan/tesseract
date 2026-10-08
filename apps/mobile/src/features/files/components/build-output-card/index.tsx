import type { BuildOutput } from "@tesseract/protocol";
import Animated from "react-native-reanimated";

import ResourceCard from "@/components/resource-card";
import { ThemedText } from "@/components/themed-text";
import { useEntrance } from "@/hooks/use-entrance";
import { useLayoutMotion } from "@/hooks/use-layout-motion";

import type { LocalFileStatus } from "../../hooks/use-local-downloads";
import { buildOutputFolder, buildOutputIcon, buildOutputMeta, buildOutputSubtitle } from "../../utils/build-outputs";
import LocalFileActions, { LocalFileProgress } from "../local-file-actions";

export type BuildOutputCardProps = {
  output: BuildOutput;
  project: string | null;
  local: LocalFileStatus;
  onDownload: () => void;
  onShare: () => void;
  /** Position in the list, for the staggered entrance. */
  index?: number;
};

const BuildOutputCard = ({ output, project, local, onDownload, onShare, index = 0 }: BuildOutputCardProps) => {
  const entering = useEntrance(index, "tight");
  const motion = useLayoutMotion();

  return (
    <Animated.View entering={entering} exiting={motion.fadeOut} layout={motion.layout}>
      <ResourceCard
        icon={buildOutputIcon(output.platform)}
        title={output.fileName}
        subtitle={buildOutputSubtitle(output, project)}
        meta={buildOutputMeta(output)}
        onPress={local.downloaded || local.progress !== undefined ? undefined : onDownload}
        footer={<LocalFileActions fileName={output.fileName} status={local} onDownload={onDownload} onShare={onShare} />}
      >
        <ThemedText variant="caption" color="textSecondary" numberOfLines={2}>
          {buildOutputFolder(output)}
        </ThemedText>
        <LocalFileProgress fileName={output.fileName} status={local} />
      </ResourceCard>
    </Animated.View>
  );
};

export default BuildOutputCard;
