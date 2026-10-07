import { PaperPlaneTiltIcon, TrashIcon } from "phosphor-react-native";
import type { Artifact } from "@theone/protocol";
import Animated from "react-native-reanimated";

import ActionButton from "@/components/action-button";
import ResourceCard from "@/components/resource-card";
import { ThemedText } from "@/components/themed-text";
import { useEntrance } from "@/hooks/use-entrance";
import { useLayoutMotion } from "@/hooks/use-layout-motion";

import type { LocalFileStatus } from "../../hooks/use-local-downloads";
import { fileIcon, fileMeta, fileSourceBadge, fileSubtitle } from "../../utils/describe";
import LocalFileActions, { LocalFileProgress } from "../local-file-actions";

export type FileCardProps = {
  artifact: Artifact;
  project: string | null;
  local: LocalFileStatus;
  onDownload: () => void;
  onShare: () => void;
  onTaildrop?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
  /** Position in the list, for the staggered entrance. */
  index?: number;
};

const FileCard = ({ artifact, project, local, onDownload, onShare, onTaildrop, onDelete, deleting = false, index = 0 }: FileCardProps) => {
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
        onPress={local.downloaded || local.progress !== undefined ? undefined : onDownload}
        footer={
          <>
            <LocalFileActions fileName={artifact.fileName} status={local} onDownload={onDownload} onShare={onShare} />
            {onTaildrop ? (
              <ActionButton
                label="Taildrop"
                icon={PaperPlaneTiltIcon}
                variant="secondary"
                size="sm"
                onPress={onTaildrop}
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
        <LocalFileProgress fileName={artifact.fileName} status={local} />
      </ResourceCard>
    </Animated.View>
  );
};

export default FileCard;
