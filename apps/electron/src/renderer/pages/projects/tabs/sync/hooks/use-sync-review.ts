import type { SyncFileChange } from "@tesseract/protocol";
import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { syncFiles, type SyncView } from "../model";
import { confirmLabel, diffDisplay, filterReviewFiles, kindCounts, sortReviewFiles } from "../review/model";
import { useFileDiff } from "./use-file-diff";

const STEP: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

export function useSyncReview(projectId: string, view: SyncView, onConfirm: (force: boolean, paths: string[]) => void, onClose: () => void) {
  const files = useMemo(() => sortReviewFiles(syncFiles(view), view.conflicts), [view]);
  const conflicts = useMemo(() => files.filter((file) => view.conflicts.includes(file.path)), [files, view.conflicts]);
  const [query, setQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(files[0]?.path ?? null);
  const visible = useMemo(() => filterReviewFiles(files, query), [files, query]);
  const selected: SyncFileChange | null = files.find((file) => file.path === selectedPath) ?? null;
  const result = useFileDiff(projectId, selected);
  const display = useMemo(() => diffDisplay(selected, result), [selected, result]);

  const confirm = useCallback(() => {
    onClose();
    onConfirm(conflicts.length > 0, files.map((file) => file.path));
  }, [onClose, onConfirm, conflicts.length, files]);

  const onListKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const step = STEP[event.key];
      if (!step || visible.length === 0) return;
      event.preventDefault();
      const index = visible.findIndex((file) => file.path === selectedPath);
      const next = visible[Math.min(visible.length - 1, Math.max(0, index + step))];
      if (next) setSelectedPath(next.path);
    },
    [visible, selectedPath],
  );

  return {
    files,
    visible,
    conflicts,
    counts: useMemo(() => kindCounts(files), [files]),
    query,
    setQuery,
    selected,
    select: setSelectedPath,
    display,
    confirmLabel: confirmLabel(files.length, conflicts.length),
    destructive: conflicts.length > 0,
    confirm,
    onListKeyDown,
  };
}
