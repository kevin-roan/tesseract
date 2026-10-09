import type { ProjectStorage, StorageCategory } from "@tesseract/protocol";
import { BroomIcon, CodeIcon, HammerIcon, PackageIcon, type Icon } from "phosphor-react-native";

import type { ConfirmOptions } from "@/lib/confirm";
import { formatBytes, formatRelativeTime } from "@/features/sandbox/utils/format";

export const STORAGE_COPY = {
  title: "Storage",
  chipLoading: "Storage…",
  chipFailed: "Storage",
  clear: "Clear",
  clearAll: "Clear all",
  loading: "Measuring the project…",
  failedTitle: "Couldn't measure this project",
  retry: "Try again",
  nothingToClear: "Nothing to clear. Dependencies, builds and caches are already gone.",
  cleared: (bytes: string) => `Freed ${bytes}`,
} as const;

export type StorageRowId = "source" | StorageCategory;

export type StorageRow = {
  id: StorageRowId;
  label: string;
  hint: string;
  icon: Icon;
  sizeBytes: number;
  paths: string[];
  clearable: boolean;
};

const ROWS: Record<StorageRowId, Pick<StorageRow, "label" | "hint" | "icon">> = {
  source: { label: "Source", hint: "Your code and git history. Never cleared.", icon: CodeIcon },
  dependencies: { label: "Dependencies", hint: "Reinstalled by the next run or build.", icon: PackageIcon },
  builds: { label: "Builds", hint: "Rebuilt by the next build.", icon: HammerIcon },
  caches: { label: "Caches", hint: "Tool caches, recreated as needed.", icon: BroomIcon },
};

export function storageChipLabel(storage: ProjectStorage | undefined, loading: boolean): string {
  if (storage) return formatBytes(storage.totalBytes);
  return loading ? STORAGE_COPY.chipLoading : STORAGE_COPY.chipFailed;
}

export function storageRows(storage: ProjectStorage): StorageRow[] {
  return [
    { id: "source", ...ROWS.source, sizeBytes: storage.sourceBytes, paths: [], clearable: false },
    ...storage.entries.map((entry) => ({
      id: entry.category,
      ...ROWS[entry.category],
      sizeBytes: entry.sizeBytes,
      paths: entry.paths,
      clearable: entry.paths.length > 0,
    })),
  ];
}

export const clearableBytes = (storage: ProjectStorage): number =>
  storage.entries.reduce((sum, entry) => sum + (entry.paths.length > 0 ? entry.sizeBytes : 0), 0);

export function storageRowSubtitle(row: StorageRow): string {
  return row.paths.length > 0 ? row.paths.join(", ") : row.hint;
}

export function storageSubtitle(storage: ProjectStorage | undefined, now: number = Date.now()): string | undefined {
  return storage ? `${formatBytes(storage.totalBytes)} · measured ${formatRelativeTime(storage.measuredAt, now)}` : undefined;
}

export function clearConfirmation(storage: ProjectStorage, category: StorageCategory | null): ConfirmOptions {
  if (category === null) {
    return {
      title: `Clear ${formatBytes(clearableBytes(storage))}?`,
      message: "Deletes dependencies, build outputs and caches in the sandbox. Source files and git history stay.",
      confirmLabel: STORAGE_COPY.clearAll,
      destructive: true,
    };
  }
  const entry = storage.entries.find((item) => item.category === category);
  return {
    title: `Clear ${ROWS[category].label.toLowerCase()}?`,
    message: `Deletes ${entry?.paths.join(", ") ?? ""} (${formatBytes(entry?.sizeBytes ?? 0)}). ${ROWS[category].hint}`,
    confirmLabel: STORAGE_COPY.clear,
    destructive: true,
  };
}
