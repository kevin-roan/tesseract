import type { ProjectFile } from "@tesseract/protocol";
import { useCallback, useEffect, useMemo, useState } from "react";
import { describeError } from "../../../app/connection";
import { useApiClient } from "../../../app/data";
import type { ConfirmOption } from "../../../components/ConfirmDialog";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import type { FileHandoff } from "../../../../shared/contracts/files";
import { TAILDROP_TIMEOUT_MS } from "../constants";
import { describeDownloadError, type DownloadSource } from "../download";
import { ARTIFACT_LABELS, formatLabel, PROJECT_FILE_LABELS, TAILDROP_LABELS } from "../labels";
import { isMissing, onlineTargets, projectFileKey, safeFileName, taildropAvailable, targetLabel } from "../model";
import { canHandOff, handOffFile, rendererFileSaver } from "../saver";
import { filesStore, useFilesStore, type DownloadState } from "../store";
import { useTaildrop } from "./use-taildrop";

export interface ProjectFileSendDialog {
  file: ProjectFile;
  options: ConfirmOption[];
}

export interface ProjectFileActions {
  downloads: DownloadState;
  canSend: boolean;
  canHandOff: boolean;
  handOffMode: FileHandoff;
  dialog: ProjectFileSendDialog | null;
  dialogOpen: boolean;
  keyOf(file: ProjectFile): string;
  save(file: ProjectFile): void;
  handOff(file: ProjectFile): void;
  requestSend(file: ProjectFile): void;
  confirmSend(targetId: string | null): void;
  closeDialog(): void;
  clearDialog(): void;
}

export function useProjectFileActions(projectId: string, report: (message: string) => void): ProjectFileActions {
  const client = useApiClient();
  const downloads = useFilesStore((state) => state.downloads);
  const { taildrop, load: loadTaildrop } = useTaildrop();
  const [handOffMode, setHandOffMode] = useState<FileHandoff>("open");
  const [dialog, setDialog] = useState<ProjectFileSendDialog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!canHandOff()) return;
    let live = true;
    ipc.files.canShare().then((share) => live && setHandOffMode(share ? "share" : "open"), () => undefined);
    return () => {
      live = false;
    };
  }, []);

  const keyOf = useCallback((file: ProjectFile) => projectFileKey(projectId, file.path), [projectId]);
  const sourceOf = useCallback((file: ProjectFile): DownloadSource => ({ kind: "project-file", projectId, path: file.path }), [projectId]);
  const missing = useCallback((file: ProjectFile) => formatLabel(PROJECT_FILE_LABELS.missing, { name: file.name }), []);

  const save = useCallback(
    (file: ProjectFile) => {
      const key = keyOf(file);
      if (!client || !filesStore.claimDownload(key)) return;
      rendererFileSaver(client)(
        { source: sourceOf(file), suggestedName: safeFileName(file.name), expectedSha256: null },
        {
          onStart: () => {
            filesStore.startDownload(key);
            showToast(formatLabel(ARTIFACT_LABELS.downloading, { name: file.name }));
          },
          onProgress: (fraction) => filesStore.setProgress(key, fraction),
        },
      )
        .then((saved) => saved && showToast(formatLabel(ARTIFACT_LABELS.saved, { name: saved })))
        .catch((error: unknown) => report(describeDownloadError(error, missing(file))))
        .finally(() => filesStore.finishDownload(key));
    },
    [client, keyOf, sourceOf, missing, report],
  );

  const handOff = useCallback(
    (file: ProjectFile) => {
      const key = keyOf(file);
      if (!client || !filesStore.claimDownload(key)) return;
      filesStore.startDownload(key);
      handOffFile(client, sourceOf(file), safeFileName(file.name), handOffMode)
        .then((name) => handOffMode === "open" && showToast(formatLabel(PROJECT_FILE_LABELS.opened, { name })))
        .catch((error: unknown) =>
          report(formatLabel(PROJECT_FILE_LABELS.handoffFailed, { name: file.name, error: isMissing(error) ? missing(file) : describeError(error) })),
        )
        .finally(() => filesStore.finishDownload(key));
    },
    [client, keyOf, sourceOf, handOffMode, missing, report],
  );

  const requestSend = useCallback(
    (file: ProjectFile) => {
      const targets = onlineTargets(taildrop);
      if (targets.length === 0) {
        report(TAILDROP_LABELS.noTargets);
        loadTaildrop();
        return;
      }
      setDialog({ file, options: targets.map((target) => ({ id: target.id, label: targetLabel(target) })) });
      setDialogOpen(true);
    },
    [taildrop, report, loadTaildrop],
  );

  const confirmSend = useCallback(
    (targetId: string | null) => {
      if (!client || !dialog || !targetId) return;
      const { file, options } = dialog;
      const name = file.name;
      const device = options.find((option) => option.id === targetId)?.label ?? targetId;
      showToast(formatLabel(TAILDROP_LABELS.sending, { name, device }));
      client.sendProjectFileToTaildrop(projectId, { path: file.path, targetId }, { timeoutMs: TAILDROP_TIMEOUT_MS }).then(
        () => showToast(formatLabel(TAILDROP_LABELS.sent, { name, device })),
        (error: unknown) => report(formatLabel(TAILDROP_LABELS.failed, { name, error: isMissing(error) ? missing(file) : describeError(error) })),
      );
    },
    [client, dialog, projectId, missing, report],
  );

  const closeDialog = useCallback(() => setDialogOpen(false), []);
  const clearDialog = useCallback(() => setDialog(null), []);

  return useMemo(
    () => ({
      downloads,
      canSend: taildropAvailable(taildrop),
      canHandOff: canHandOff(),
      handOffMode,
      dialog,
      dialogOpen,
      keyOf,
      save,
      handOff,
      requestSend,
      confirmSend,
      closeDialog,
      clearDialog,
    }),
    [downloads, taildrop, handOffMode, dialog, dialogOpen, keyOf, save, handOff, requestSend, confirmSend, closeDialog, clearDialog],
  );
}
