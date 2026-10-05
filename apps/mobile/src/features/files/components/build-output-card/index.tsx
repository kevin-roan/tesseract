import { DownloadSimpleIcon } from "phosphor-react-native";
import type { BuildOutput } from "@theone/protocol";
import Animated from "react-native-reanimated";

import ActionButton from "@/components/action-button";
import ResourceCard from "@/components/resource-card";
import { ThemedText } from "@/components/themed-text";
import { useEntrance } from "@/hooks/use-entrance";
import { useLayoutMotion } from "@/hooks/use-layout-motion";

import { buildOutputFolder, buildOutputIcon, buildOutputMeta, buildOutputSubtitle } from "../../utils/build-outputs";

export type BuildOutputCardProps = {
  output: BuildOutput;
  project: string | null;
  onDownload: () => void;
  downloading?: boolean;
  /** Position in the list, for the staggered entrance. */
  index?: number;
};

const BuildOutputCard = ({ output, project, onDownload, downloading = false, index = 0 }: BuildOutputCardProps) => {
  const entering = useEntrance(index, "tight");
  const motion = useLayoutMotion();

  return (
    <Animated.View entering={entering} exiting={motion.fadeOut} layout={motion.layout}>
      <ResourceCard
        icon={buildOutputIcon(output.platform)}
        title={output.fileName}
        subtitle={buildOutputSubtitle(output, project)}
        meta={buildOutputMeta(output)}
        onPress={onDownload}
        footer={
          <ActionButton
            label="Download"
            icon={DownloadSimpleIcon}
            variant="secondary"
            size="sm"
            loading={downloading}
            onPress={onDownload}
            accessibilityLabel={`Download ${output.fileName}`}
          />
        }
      >
        <ThemedText variant="caption" color="textSecondary" numberOfLines={2}>
          {buildOutputFolder(output)}
        </ThemedText>
      </ResourceCard>
    </Animated.View>
  );
};

export default BuildOutputCard;
