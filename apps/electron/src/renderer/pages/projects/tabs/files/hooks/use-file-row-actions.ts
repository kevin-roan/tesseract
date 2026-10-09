import type { ProjectFile } from "@tesseract/protocol";
import { useMemo } from "react";
import type { RowAction } from "../../../../../components/RecordRow";
import type { ProjectFileActions } from "../../../../../features/files/hooks/use-project-file-actions";
import { ARTIFACT_LABELS, PROJECT_FILE_LABELS } from "../../../../../features/files/labels";
import { HANDOFF_ICONS, SAVE_ICON, SEND_ICON } from "../constants";
import { isDownloadable } from "../model";

export function useFileRowActions(file: ProjectFile, actions: ProjectFileActions, busy: boolean): RowAction[] {
  const { save, handOff, requestSend, canSend, canHandOff, handOffMode } = actions;
  return useMemo(() => {
    if (!isDownloadable(file)) return [];
    const list: RowAction[] = [{ id: "save", icon: SAVE_ICON, label: ARTIFACT_LABELS.save, onActivate: () => save(file), sensitive: !busy }];
    if (canHandOff) {
      list.push({ id: "handoff", icon: HANDOFF_ICONS[handOffMode], label: PROJECT_FILE_LABELS[handOffMode], onActivate: () => handOff(file), sensitive: !busy });
    }
    if (canSend) list.push({ id: "send", icon: SEND_ICON, label: ARTIFACT_LABELS.send, onActivate: () => requestSend(file) });
    return list;
  }, [file, busy, canSend, canHandOff, handOffMode, save, handOff, requestSend]);
}
