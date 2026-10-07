import type { Artifact } from "@theone/protocol";
import { RecordRow } from "../../components/RecordRow";
import { artifactMeta, artifactNote, fileIcon, sourceBadge } from "../../features/files/model";
import { useArtifactRowActions } from "../../features/files/hooks/use-row-actions";
import type { FileActions } from "../../features/files/hooks/use-file-actions";
import { ARTIFACT_LABELS } from "../../features/files/labels";
import styles from "./FilesPage.module.css";

export interface ArtifactRowProps {
  artifact: Artifact;
  actions: FileActions;
}

export function ArtifactRow({ artifact, actions }: ArtifactRowProps) {
  const downloading = artifact.id in actions.downloads;
  const badge = sourceBadge(artifact);
  return (
    <RecordRow
      title={artifact.fileName}
      subtitle={artifactNote(artifact)}
      icon={fileIcon(artifact.fileName)}
      progress={downloading ? (actions.downloads[artifact.id] ?? null) : undefined}
      progressLabel={ARTIFACT_LABELS.progress}
      className={styles.fileRow}
      meta={artifactMeta(artifact)}
      status={badge ? { label: badge.label, tone: badge.tone } : null}
      actions={useArtifactRowActions(artifact, actions, downloading)}
    />
  );
}
