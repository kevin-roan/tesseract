import { STORAGE_CATEGORIES, type ProjectStorage, type StorageCategory } from "@tesseract/protocol";
import { formatBytes } from "./format";
import { STORAGE_LABELS } from "./labels";

const PATHS_SHOWN = 3;

export interface StorageRow {
  id: string;
  category: StorageCategory | null;
  label: string;
  size: string;
  clearable: boolean;
}

export function storageChipLabel(storage: ProjectStorage | null, failed: boolean): string {
  if (storage) return formatBytes(storage.totalBytes);
  return failed ? STORAGE_LABELS.unknown : STORAGE_LABELS.measuring;
}

export function regenerableBytes(storage: ProjectStorage, categories: readonly StorageCategory[] = STORAGE_CATEGORIES): number {
  return storage.entries.filter((entry) => categories.includes(entry.category)).reduce((sum, entry) => sum + entry.sizeBytes, 0);
}

export function storageRows(storage: ProjectStorage): StorageRow[] {
  return [
    { id: "source", category: null, label: STORAGE_LABELS.source, size: formatBytes(storage.sourceBytes), clearable: false },
    ...STORAGE_CATEGORIES.map((category) => {
      const entry = storage.entries.find((item) => item.category === category);
      return {
        id: category,
        category,
        label: STORAGE_LABELS.categories[category],
        size: formatBytes(entry?.sizeBytes ?? 0),
        clearable: (entry?.paths.length ?? 0) > 0,
      };
    }),
  ];
}

export function clearPrompt(storage: ProjectStorage, categories: readonly StorageCategory[]): { heading: string; body: string } {
  const paths = storage.entries.filter((entry) => categories.includes(entry.category)).flatMap((entry) => entry.paths);
  const shown = paths.slice(0, PATHS_SHOWN).join(", ");
  const listed = paths.length > PATHS_SHOWN ? STORAGE_LABELS.more(shown, paths.length - PATHS_SHOWN) : shown;
  const what = categories.length === 1 ? STORAGE_LABELS.categories[categories[0]!].toLowerCase() : STORAGE_LABELS.confirmAllWhat;
  return {
    heading: STORAGE_LABELS.confirmHeading(what),
    body: STORAGE_LABELS.confirmBody(listed, formatBytes(regenerableBytes(storage, categories))),
  };
}
