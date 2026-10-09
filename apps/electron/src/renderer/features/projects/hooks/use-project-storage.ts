import { STORAGE_CATEGORIES, type ProjectStorage, type StorageCategory } from "@tesseract/protocol";
import { useCallback, useEffect, useMemo, useState } from "react";
import { describeError } from "../../../app/connection";
import { useApiClient } from "../../../app/data";
import { showToast } from "../../../components/Toast";
import { formatBytes } from "../format";
import { STORAGE_LABELS } from "../labels";
import { clearPrompt, regenerableBytes, storageChipLabel, storageRows } from "../storage";

export function useProjectStorage(projectId: string, report: (error: unknown) => void) {
  const client = useApiClient();
  const [storage, setStorage] = useState<ProjectStorage | null>(null);
  const [failed, setFailed] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pending, setPending] = useState<readonly StorageCategory[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    setStorage(null);
    setFailed(false);
    client.projectStorage(projectId, { signal: controller.signal }).then(setStorage, () => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [client, projectId]);

  const request = useCallback((categories: readonly StorageCategory[] = STORAGE_CATEGORIES) => {
    setPending(categories);
    setConfirmOpen(true);
  }, []);

  const confirm = useCallback(() => {
    if (!client || !storage || !pending) return;
    const before = regenerableBytes(storage, pending);
    setClearing(true);
    client
      .clearProjectStorage(projectId, { categories: [...pending] })
      .then(
        (next) => {
          setStorage(next);
          showToast(STORAGE_LABELS.cleared(formatBytes(Math.max(0, before - regenerableBytes(next, pending)))));
        },
        (error: unknown) => report(new Error(STORAGE_LABELS.failed(describeError(error)))),
      )
      .finally(() => setClearing(false));
  }, [client, storage, pending, projectId, report]);

  const closeConfirm = useCallback(() => setConfirmOpen(false), []);
  const clearPending = useCallback(() => setPending(null), []);

  return useMemo(
    () => ({
      label: storageChipLabel(storage, failed),
      total: storage ? formatBytes(storage.totalBytes) : null,
      rows: storage ? storageRows(storage) : [],
      canClearAll: storage?.entries.some((entry) => entry.paths.length > 0) ?? false,
      clearing,
      prompt: storage && pending ? clearPrompt(storage, pending) : null,
      confirmOpen,
      request,
      confirm,
      closeConfirm,
      clearPending,
    }),
    [storage, failed, clearing, pending, confirmOpen, request, confirm, closeConfirm, clearPending],
  );
}
