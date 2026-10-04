import { DownloadSimpleIcon, PaperPlaneTiltIcon, TrashIcon } from "phosphor-react-native";
import type { Artifact } from "@theone/protocol";
import Animated from "react-native-reanimated";

import ActionButton from "@/components/action-button";
import ResourceCard from "@/components/resource-card";
import { ThemedText } from "@/components/themed-text";
import { useEntrance } from "@/hooks/use-entrance";
import { useLayoutMotion } from "@/hooks/use-layout-motion";

import { fileIcon, fileMeta, fileSourceBadge, fileSubtitle } from "../../utils/describe";

export type FileCardProps = {
  artifact: Artifact;
  project: string | null;
  onDownload: () => void;
  onSend?: () => void;
  onDelete?: () => void;
  downloading?: boolean;
  deleting?: boolean;
  /** Position in the list, for the staggered entrance. */
  index?: number;
};

const FileCard = ({
  artifact,
  project,
  onDownload,
  onSend,
  onDelete,
  downloading = false,
  deleting = false,
  index = 0,
}: FileCardProps) => {
  const entering = useEntrance(index, "tight");
  const motion = useLayoutMotion();

  return (
    <Animated.View entering={entering} exiting={motion.fadeOut} layout={motion.layout}>
      <ResourceCard
        icon={fileIcon(artifact.source)}
        title={artifact.fileName}
        subtitle={fileSubtitle(artifact, project)}
        meta={fileMeta(artifact)}
        badge={fileSourceBadge(artifact.source)}
        onPress={onDownload}
        footer={
          <>
            <ActionButton
              label="Download"
              icon={DownloadSimpleIcon}
              variant="secondary"
              size="sm"
              loading={downloading}
              onPress={onDownload}
              accessibilityLabel={`Download ${artifact.fileName}`}
            />
            {onSend ? (
              <ActionButton
                label="Send"
                icon={PaperPlaneTiltIcon}
                variant="secondary"
                size="sm"
                onPress={onSend}
                accessibilityLabel={`Send ${artifact.fileName} with Taildrop`}
              />
            ) : null}
            {onDelete ? (
              <ActionButton
                label="Delete"
                icon={TrashIcon}
                variant="danger"
                size="sm"
                loading={deleting}
                onPress={onDelete}
                accessibilityLabel={`Delete ${artifact.fileName}`}
              />
            ) : null}
          </>
        }
      >
        {artifact.note ? (
          <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={4}>
            {artifact.note}
          </ThemedText>
        ) : null}
      </ResourceCard>
    </Animated.View>
  );
};

export default FileCard;
