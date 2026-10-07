import type { TheOneClient } from "@theone/client";
import type { Artifact, BuildOutput } from "@theone/protocol";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describeError } from "../../../app/connection";
import { useApiClient } from "../../../app/data";
import type { ConfirmOption } from "../../../components/ConfirmDialog";
import { showToast } from "../../../components/Toast";
import { ipc } from "../../../lib/ipc";
import { TAILDROP_TIMEOUT_MS } from "../constants";
import { describeDownloadError, type DownloadSource } from "../download";
import { ARTIFACT_LABELS, DELETE_LABELS, formatLabel, OUTPUT_LABELS, TAILDROP_LABELS } from "../labels";
import { findArtifact, isMissing, onlineTargets, outputKey, safeFileName, taildropAvailable, targetLabel } from "../model";
import { rendererFileSaver } from "../saver";
import { filesStore, scopedData, useFilesStore, type DownloadState } from "../store";

export type { DownloadState } from "../store";

export type FilesDialog =
  | { kind: "delete"; artifact: Artifact }
  | { kind: "send"; artifact: Artifact; options: ConfirmOption[] };

export interface FileActions {
  downloads: DownloadState;
  canSend: boolean;
  dialog: FilesDialog | null;
  dialogOpen: boolean;
  save(artifact: Artifact): void;
  saveOutput(output: BuildOutput): void;
  saveById(id: string, projectId: string | null, known: readonly Artifact[] | null): void;
  openLink(artifact: Artifact): void;
  openOutputLink(output: BuildOutput): void;
  requestDelete(artifact: Artifact): void;
  requestSend(artifact: Artifact): void;
  confirmDelete(artifact: Artifact): void;
  confirmSend(artifact: Artifact, targetId: string | null, options: readonly ConfirmOption[]): void;
  closeDialog(): void;
  clearDialog(): void;
}

interface DownloadJob {
  key: string;
  fileName: string;
  missing: string;
  source: DownloadSource;
  expectedSha256: string | null;
}

export function useFileActions(report: (message: string) => void, onDeleted: (id: string) => void): FileActions {
  const client = useApiClient();
  const scope = client?.baseUrl ?? null;
  const downloads = useFilesStore((state) => state.downloads);
  const taildrop = useFilesStore((state) => scopedData(state, scope).taildrop);
  const [dialog, setDialog] = useState<FilesDialog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const taildropLoading = useRef(false);

  const loadTaildrop = useCallback(() => {
    if (!client || !scope || taildropLoading.current) return;
    taildropLoading.current = true;
    client
      .taildropTargets()
      .then((targets) => filesStore.setTaildrop(scope, targets), () => undefined)
      .finally(() => {
        taildropLoading.current = false;
      });
  }, [client, scope]);

  useEffect(() => {
    if (scope && !scopedData(useFilesStore.getState(), scope).taildrop) loadTaildrop();
  }, [scope, loadTaildrop]);

  const download = useCallback(
    async (job: DownloadJob) => {
      if (!client || !filesStore.claimDownload(job.key)) return;
      try {
        const saved = await rendererFileSaver(client)(
          { source: job.source, suggestedName: safeFileName(job.fileName), expectedSha256: job.expectedSha256 },
          {
            onStart: () => {
              filesStore.startDownload(job.key);
              showToast(formatLabel(ARTIFACT_LABELS.downloading, { name: job.fileName }));
            },
            onProgress: (fraction) => filesStore.setProgress(job.key, fraction),
          },
        );
        if (saved) showToast(formatLabel(ARTIFACT_LABELS.saved, { name: saved }));
      } catch (error) {
        report(describeDownloadError(error, job.missing));
      } finally {
        filesStore.finishDownload(job.key);
      }
    },
    [client, report],
  );

  const save = useCallback(
    (artifact: Artifact) =>
      void download({
        key: artifact.id,
        fileName: artifact.fileName,
        missing: formatLabel(ARTIFACT_LABELS.missing, { name: artifact.fileName }),
        source: { kind: "artifact", id: artifact.id },
        expectedSha256: artifact.sha256,
      }),
    [download],
  );

  const saveOutput = useCallback(
    (output: BuildOutput) =>
      void download({
        key: outputKey(output),
        fileName: output.fileName,
        missing: formatLabel(OUTPUT_LABELS.missing, { name: output.fileName }),
        source: { kind: "output", projectId: output.projectId, path: output.path },
        expectedSha256: null,
      }),
    [download],
  );

  const saveById = useCallback(
    (id: string, projectId: string | null, known: readonly Artifact[] | null) => {
      const match = findArtifact(known, id);
      if (match) {
        save(match);
        return;
      }
      if (!client) return;
      client.listArtifacts(projectId ? { projectId } : undefined).then(
        (artifacts) => {
          const found = findArtifact(artifacts, id);
          if (found) save(found);
          else report(ARTIFACT_LABELS.missingUnknown);
        },
        (error: unknown) => report(describeError(error)),
      );
    },
    [client, report, save],
  );

  const openUrl = useCallback(
    (resolve: (api: TheOneClient) => Promise<string>, missing: string | null) => {
      if (!client) return;
      resolve(client)
        .then((url) => ipc.app.openExternal(url))
        .catch((error: unknown) => report(missing && isMissing(error) ? missing : describeError(error)));
    },
    [client, report],
  );

  const openLink = useCallback((artifact: Artifact) => openUrl((api) => api.artifactDownloadUrl(artifact.id), null), [openUrl]);

  const openOutputLink = useCallback(
    (output: BuildOutput) =>
      openUrl((api) => api.buildOutputDownloadUrl(output), formatLabel(OUTPUT_LABELS.missing, { name: output.fileName })),
    [openUrl],
  );

  const openDialog = useCallback((next: FilesDialog) => {
    setDialog(next);
    setDialogOpen(true);
  }, []);

  const requestDelete = useCallback((artifact: Artifact) => openDialog({ kind: "delete", artifact }), [openDialog]);

  const confirmDelete = useCallback(
    (artifact: Artifact) => {
      if (!client) return;
      const name = artifact.fileName;
      client.deleteArtifact(artifact.id).then(
        () => {
          onDeleted(artifact.id);
          showToast(formatLabel(DELETE_LABELS.done, { name }));
        },
        (error: unknown) => {
          if (isMissing(error)) onDeleted(artifact.id);
          else report(formatLabel(DELETE_LABELS.failed, { name, error: describeError(error) }));
        },
      );
    },
    [client, onDeleted, report],
  );

  const requestSend = useCallback(
    (artifact: Artifact) => {
      const targets = onlineTargets(taildrop);
      if (targets.length === 0) {
        report(TAILDROP_LABELS.noTargets);
        loadTaildrop();
        return;
      }
      openDialog({ kind: "send", artifact, options: targets.map((target) => ({ id: target.id, label: targetLabel(target) })) });
    },
    [taildrop, report, loadTaildrop, openDialog],
  );

  const confirmSend = useCallback(
    (artifact: Artifact, targetId: string | null, options: readonly ConfirmOption[]) => {
      if (!client || !targetId) return;
      const name = artifact.fileName;
      const device = options.find((option) => option.id === targetId)?.label ?? targetId;
      showToast(formatLabel(TAILDROP_LABELS.sending, { name, device }));
      client.sendArtifactToTaildrop(artifact.id, { targetId }, { timeoutMs: TAILDROP_TIMEOUT_MS }).then(
        () => showToast(formatLabel(TAILDROP_LABELS.sent, { name, device })),
        (error: unknown) => {
          const detail = isMissing(error) ? formatLabel(ARTIFACT_LABELS.missing, { name }) : describeError(error);
          report(formatLabel(TAILDROP_LABELS.failed, { name, error: detail }));
        },
      );
    },
    [client, report],
  );

  const closeDialog = useCallback(() => setDialogOpen(false), []);
  const clearDialog = useCallback(() => setDialog(null), []);

  return useMemo(
    () => ({
      downloads,
      canSend: taildropAvailable(taildrop),
      dialog,
      dialogOpen,
      save,
      saveOutput,
      saveById,
      openLink,
      openOutputLink,
      requestDelete,
      requestSend,
      confirmDelete,
      confirmSend,
      closeDialog,
      clearDialog,
    }),
    [downloads, taildrop, dialog, dialogOpen, clearDialog, save, saveOutput, saveById, openLink, openOutputLink, requestDelete, requestSend, confirmDelete, confirmSend, closeDialog],
  );
}
