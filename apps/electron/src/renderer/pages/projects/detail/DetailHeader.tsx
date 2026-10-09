import type { Project } from "@tesseract/protocol";
import { IconButton } from "../../../components/IconButton";
import { Text } from "../../../components/Text";
import { PROJECTS_ICONS } from "../../../features/projects/constants";
import { DETAIL_LABELS } from "../../../features/projects/labels";
import type { PropertyChipModel } from "../../../features/projects/types";
import { PropertyChips } from "./PropertyChips";
import { StorageChip } from "./StorageChip";
import styles from "./ProjectDetail.module.css";

export interface DetailHeaderProps {
  project: Project;
  title: string;
  chips: readonly PropertyChipModel[];
  removing: boolean;
  onCopyPath(): void;
  onRename(): void;
  onDelete(): void;
  onError(error: unknown): void;
}

export function DetailHeader({ project, title, chips, removing, onCopyPath, onRename, onDelete, onError }: DetailHeaderProps) {
  return (
    <>
      <div className={styles.crumb}>
        <Text variant="caption" color="text-tertiary">
          {project.id}
        </Text>
        <span className={styles.crumbPath}>
          <Text variant="code" color="text-tertiary" selectable>
            {project.path}
          </Text>
        </span>
        <IconButton icon={PROJECTS_ICONS.copy} label={DETAIL_LABELS.copyPath} size={24} onClick={onCopyPath} />
        <IconButton icon={PROJECTS_ICONS.rename} label={DETAIL_LABELS.rename} size={24} onClick={onRename} />
        <IconButton icon={PROJECTS_ICONS.delete} label={DETAIL_LABELS.delete} size={24} destructive disabled={removing} onClick={onDelete} />
      </div>
      <Text as="h1" variant="h1" selectable className={styles.title}>
        {title}
      </Text>
      <PropertyChips chips={chips}>
        <StorageChip projectId={project.id} report={onError} />
      </PropertyChips>
    </>
  );
}
