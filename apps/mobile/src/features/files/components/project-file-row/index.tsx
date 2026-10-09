import type { ProjectFile } from "@tesseract/protocol";
import Animated from "react-native-reanimated";

import ListCard from "@/components/list-card";
import ResourceCard from "@/components/resource-card";
import { useEntrance } from "@/hooks/use-entrance";
import { useLayoutMotion } from "@/hooks/use-layout-motion";

import type { LocalFileStatus } from "../../hooks/use-local-downloads";
import { isDownloadable, projectFileIcon, projectFileSubtitle } from "../../utils/project-files";
import LocalFileActions, { LocalFileProgress } from "../local-file-actions";

export type ProjectFileRowProps = {
  file: ProjectFile;
  local: LocalFileStatus;
  onOpen: () => void;
  onDownload: () => void;
  onShare: () => void;
  onTaildrop?: () => void;
  /** Position in the list, for the staggered entrance. */
  index?: number;
};

const ProjectFileRow = ({ file, local, onOpen, onDownload, onShare, onTaildrop, index = 0 }: ProjectFileRowProps) => {
  const entering = useEntrance(index, "tight");
  const motion = useLayoutMotion();

  return (
    <Animated.View entering={entering} exiting={motion.fadeOut} layout={motion.layout}>
      {isDownloadable(file) ? (
        <ResourceCard
          icon={projectFileIcon(file)}
          title={file.name}
          subtitle={projectFileSubtitle(file)}
          footer={<LocalFileActions fileName={file.name} status={local} onDownload={onDownload} onShare={onShare} onTaildrop={onTaildrop} />}
        >
          <LocalFileProgress fileName={file.name} status={local} />
        </ResourceCard>
      ) : (
        <ListCard
          icon={projectFileIcon(file)}
          title={file.name}
          subtitle={projectFileSubtitle(file) || undefined}
          onPress={file.kind === "dir" ? onOpen : undefined}
        />
      )}
    </Animated.View>
  );
};

export default ProjectFileRow;
