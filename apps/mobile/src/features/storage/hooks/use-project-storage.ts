import { useCallback, useMemo, useState } from "react";
import type { StorageCategory } from "@tesseract/protocol";

import { useClearProjectStorage } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { useProjectStorage as useProjectStorageQuery } from "@/features/sandbox/hooks/use-sandbox-queries";
import { describeError } from "@/features/sandbox/utils/errors";
import { formatBytes } from "@/features/sandbox/utils/format";
import { confirm } from "@/lib/confirm";

import {
  clearableBytes,
  clearConfirmation,
  storageChipLabel,
  storageRows,
  storageSubtitle,
  STORAGE_COPY,
  type StorageRowId,
} from "../utils/content";

/** Disk usage of a project with a sheet to clear its regenerable folders. */
export function useProjectStorage(projectId: string) {
  const query = useProjectStorageQuery(projectId);
  const clearing = useClearProjectStorage();
  const [open, setOpen] = useState(false);
  const [freed, setFreed] = useState<number | null>(null);
  const storage = query.data;
  const { mutate, reset } = clearing;

  const clear = useCallback(
    async (category: StorageCategory | null) => {
      if (!storage) return;
      if (!(await confirm(clearConfirmation(storage, category)))) return;
      const before = storage.totalBytes;
      setFreed(null);
      mutate(
        { projectId, ...(category ? { categories: [category] } : {}) },
        { onSuccess: (next) => setFreed(Math.max(0, before - next.totalBytes)) },
      );
    },
    [mutate, projectId, storage],
  );

  const { refetch } = query;
  const show = useCallback(() => {
    reset();
    setFreed(null);
    setOpen(true);
    void refetch();
  }, [reset, refetch]);

  const rows = useMemo(() => (storage ? storageRows(storage) : []), [storage]);

  return {
    chipLabel: storageChipLabel(storage, query.isLoading),
    open,
    show,
    close: () => setOpen(false),
    subtitle: storageSubtitle(storage),
    rows,
    loading: query.isLoading,
    error: query.error ? describeError(query.error) : null,
    retry: () => void query.refetch(),
    canClearAll: storage ? clearableBytes(storage) > 0 : false,
    clear: (id: StorageRowId) => {
      if (id !== "source") void clear(id);
    },
    clearAll: () => void clear(null),
    clearingCategory: clearing.isPending ? (clearing.variables.categories?.[0] ?? "all") : null,
    clearError: clearing.error ? describeError(clearing.error) : null,
    clearedMessage: freed !== null ? STORAGE_COPY.cleared(formatBytes(freed)) : null,
  };
}

export type ProjectStorageState = ReturnType<typeof useProjectStorage>;
