import type { Artifact, BuildOutput } from "@theone/protocol";
import { useMemo } from "react";
import type { RowAction } from "../../../components/RecordRow";
import { ARTIFACT_LABELS } from "../labels";
import type { FileActions } from "./use-file-actions";

export function useArtifactRowActions(artifact: Artifact, actions: FileActions, downloading: boolean): RowAction[] {
  const { save, openLink, requestSend, requestDelete, canSend } = actions;
  return useMemo(() => {
    const list: RowAction[] = [
      { id: "save", icon: "save", label: ARTIFACT_LABELS.save, onActivate: () => save(artifact), sensitive: !downloading },
      { id: "open", icon: "external", label: ARTIFACT_LABELS.open, onActivate: () => openLink(artifact) },
    ];
    if (canSend) list.push({ id: "send", icon: "send", label: ARTIFACT_LABELS.send, onActivate: () => requestSend(artifact) });
    list.push({ id: "delete", icon: "delete", label: ARTIFACT_LABELS.delete, onActivate: () => requestDelete(artifact), destructive: true });
    return list;
  }, [artifact, downloading, canSend, save, openLink, requestSend, requestDelete]);
}

export function useOutputRowActions(output: BuildOutput, actions: FileActions, downloading: boolean): RowAction[] {
  const { saveOutput, openOutputLink } = actions;
  return useMemo(
    () => [
      { id: "save", icon: "save", label: ARTIFACT_LABELS.save, onActivate: () => saveOutput(output), sensitive: !downloading },
      { id: "open", icon: "external", label: ARTIFACT_LABELS.open, onActivate: () => openOutputLink(output) },
    ],
    [output, downloading, saveOutput, openOutputLink],
  );
}
