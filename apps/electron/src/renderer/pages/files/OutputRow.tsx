import type { BuildOutput } from "@theone/protocol";
import { RecordRow } from "../../components/RecordRow";
import type { FileActions } from "../../features/files/hooks/use-file-actions";
import { ARTIFACT_LABELS } from "../../features/files/labels";
import { fileIcon, outputFolder, outputKey, outputMeta } from "../../features/files/model";
import { useOutputRowActions } from "../../features/files/hooks/use-row-actions";
import styles from "./FilesPage.module.css";

export interface OutputRowProps {
  output: BuildOutput;
  actions: FileActions;
}

export function OutputRow({ output, actions }: OutputRowProps) {
  const key = outputKey(output);
  const downloading = key in actions.downloads;
  return (
    <RecordRow
      title={output.fileName}
      subtitle={outputFolder(output)}
      monospaceSubtitle
      icon={fileIcon(output.fileName)}
      progress={downloading ? (actions.downloads[key] ?? null) : undefined}
      progressLabel={ARTIFACT_LABELS.progress}
      className={styles.fileRow}
      meta={outputMeta(output)}
      actions={useOutputRowActions(output, actions, downloading)}
    />
  );
}
