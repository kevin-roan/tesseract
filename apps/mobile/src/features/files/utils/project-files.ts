import type { ProjectDirectory, ProjectFile, ProjectFileKind } from "@tesseract/protocol";
import { FileIcon, FolderIcon, LinkSimpleIcon, type Icon } from "phosphor-react-native";

import type { ChoiceOption } from "@/components/choice-group";
import { formatBytes, formatRelativeTime, pluralize } from "@/features/sandbox/utils/format";

export const PROJECT_FILES_COPY = {
  title: "Files",
  loading: "Loading files…",
  failedTitle: "Couldn't open this folder",
  retry: "Try again",
  empty: "This folder is empty.",
  truncated: "Only the first entries of this large folder are shown.",
  breadcrumbs: "Folder path",
} as const;

const KIND_ICONS: Record<ProjectFileKind, Icon> = {
  dir: FolderIcon,
  file: FileIcon,
  symlink: LinkSimpleIcon,
  other: FileIcon,
};

const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

export const projectFileIcon = (file: ProjectFile): Icon => KIND_ICONS[file.kind];

export const isDownloadable = (file: ProjectFile): boolean => file.kind === "file";

export function projectFileSubtitle(file: ProjectFile, now: number = Date.now()): string {
  return join([
    file.sizeBytes === null ? null : formatBytes(file.sizeBytes),
    file.modifiedAt ? formatRelativeTime(file.modifiedAt, now) : null,
  ]);
}

export function parentPath(path: string): string | null {
  if (!path) return null;
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

/** Root first; each option's id is the folder path to open. */
export function breadcrumbs(path: string, rootLabel: string): ChoiceOption[] {
  const parts = path ? path.split("/") : [];
  return [
    { id: "", label: rootLabel },
    ...parts.map((part, index) => ({ id: parts.slice(0, index + 1).join("/"), label: part })),
  ];
}

export function directorySubtitle(directory: ProjectDirectory | undefined): string | undefined {
  if (!directory) return undefined;
  const folders = directory.entries.filter((entry) => entry.kind === "dir").length;
  const files = directory.entries.length - folders;
  return join([folders ? pluralize(folders, "folder") : null, files ? pluralize(files, "file") : null]) || undefined;
}
