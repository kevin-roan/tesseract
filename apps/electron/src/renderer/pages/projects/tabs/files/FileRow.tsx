import type { ProjectFile } from "@tesseract/protocol";
import { RecordRow } from "../../../../components/RecordRow";
import type { ProjectFileActions } from "../../../../features/files/hooks/use-project-file-actions";
import { ARTIFACT_LABELS } from "../../../../features/files/labels";
import { useFileRowActions } from "./hooks/use-file-row-actions";
import { entryIcon, entryMeta, isFolder } from "./model";

export interface FileRowProps {
  file: ProjectFile;
  actions: ProjectFileActions;
  onOpen(file: ProjectFile): void;
}

export function FileRow({ file, actions, onOpen }: FileRowProps) {
  const key = actions.keyOf(file);
  const busy = key in actions.downloads;
  return (
    <RecordRow
      title={file.name}
      icon={entryIcon(file)}
      meta={entryMeta(file)}
      progress={busy ? (actions.downloads[key] ?? null) : undefined}
      progressLabel={ARTIFACT_LABELS.progress}
      actions={useFileRowActions(file, actions, busy)}
      onActivate={isFolder(file) ? () => onOpen(file) : undefined}
    />
  );
}
