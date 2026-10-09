import type { ProjectFile } from "@tesseract/protocol";
import type { Crumb } from "../../../../components/Breadcrumbs";
import { fileIcon } from "../../../../features/files/model";
import { formatBytes, formatRelativeTime, joinMeta } from "../../../../features/overview/format";
import type { IconName } from "../../../../theme/icons";
import { FOLDER_ICON, LINK_ICON } from "./constants";

export const ROOT_PATH = "";

export function pathCrumbs(rootLabel: string, path: string): Crumb[] {
  const parts = path ? path.split("/") : [];
  return [{ id: ROOT_PATH, label: rootLabel }, ...parts.map((part, index) => ({ id: parts.slice(0, index + 1).join("/"), label: part }))];
}

export function parentPath(path: string): string {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ROOT_PATH;
}

export function entryIcon(file: ProjectFile): IconName {
  if (file.kind === "dir") return FOLDER_ICON;
  if (file.kind === "symlink") return LINK_ICON;
  return fileIcon(file.name);
}

export function entryMeta(file: ProjectFile, now?: number): string {
  return joinMeta(file.kind === "file" ? formatBytes(file.sizeBytes) : null, file.modifiedAt ? formatRelativeTime(file.modifiedAt, now) : null);
}

export const isFolder = (file: ProjectFile) => file.kind === "dir";
export const isDownloadable = (file: ProjectFile) => file.kind === "file";
