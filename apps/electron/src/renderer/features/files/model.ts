import { ApiError } from "@theone/client";
import type { Artifact, ArtifactSource, BuildOutput, Project, TaildropTarget, TaildropTargets } from "@theone/protocol";
import { IpcError } from "../../../shared/ipc-types";
import type { ChoiceOption } from "../../components/ChoiceDropdown";
import type { PillTab } from "../../components/PillTabs";
import type { Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import {
  ALL,
  DEFAULT_FILE_ICON,
  FALLBACK_FILE_NAME,
  FILE_ICONS,
  FILE_VIEWS,
  OUTPUT_PLATFORM_HIDDEN,
  SOURCE_TONES,
  type FileView,
} from "./constants";
import { formatBytes, formatRelativeTime, joinMeta, parseIso } from "../overview/format";
import { EMPTY_PLATFORM, FILES_LABELS, OUTPUT_LABELS, SOURCE_LABELS, VIEW_LABELS } from "./labels";

export interface FileGroup<T> {
  key: string;
  title: string;
  items: T[];
}

export const artifactKey = (artifact: Artifact) => artifact.id;

export interface EmptyCopy {
  title: string;
  message: string | null;
}

const UNSAFE_FILE_CHARS = /[\x00-\x1f]+/g;
const PATH_SEPARATORS = /[\\/]/;

export function safeFileName(name: string, fallback: string = FALLBACK_FILE_NAME): string {
  const last = name.split(PATH_SEPARATORS).pop() ?? "";
  const cleaned = last.replace(UNSAFE_FILE_CHARS, "_").trim().replace(/^\.+/, "");
  return cleaned || fallback;
}

export function fileIcon(name: string): IconName {
  const dot = name.lastIndexOf(".");
  const extension = dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
  return FILE_ICONS[extension] ?? DEFAULT_FILE_ICON;
}

export function projectNames(projects: readonly Project[] | null | undefined): Record<string, string> {
  const names: Record<string, string> = {};
  for (const project of projects ?? []) names[project.id] = project.name || project.id;
  return names;
}

export function byProject<T extends { projectId: string }>(items: readonly T[], names: Record<string, string>): FileGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.projectId || "";
    const members = groups.get(key);
    if (members) members.push(item);
    else groups.set(key, [item]);
  }
  return [...groups].map(([key, members]) => ({ key, title: names[key] || key || FILES_LABELS.noProject, items: members }));
}

export function sourceOf(artifact: Pick<Artifact, "source">): ArtifactSource {
  return artifact.source === "agent" ? "agent" : "build";
}

export function sourceBadge(artifact: Pick<Artifact, "source">): { label: string; tone: Tone } | null {
  const source = sourceOf(artifact);
  const tone = SOURCE_TONES[source];
  return tone === "neutral" ? null : { label: SOURCE_LABELS[source], tone };
}

export function artifactMeta(artifact: Artifact, now?: number): string {
  return joinMeta(formatBytes(artifact.sizeBytes), artifact.platform || EMPTY_PLATFORM, formatRelativeTime(artifact.createdAt, now));
}

export function artifactNote(artifact: Pick<Artifact, "note">): string | null {
  return artifact.note?.trim() || null;
}

const byTimeDesc = <T>(time: (item: T) => string | null | undefined) => (a: T, b: T) =>
  (parseIso(time(b)) ?? 0) - (parseIso(time(a)) ?? 0);

export function newestArtifacts(artifacts: readonly Artifact[] | null | undefined): Artifact[] {
  return [...(artifacts ?? [])].sort(byTimeDesc((artifact) => artifact.createdAt));
}

export function filterArtifacts(artifacts: readonly Artifact[] | null | undefined, projectId: string = ALL, source: string = ALL): Artifact[] {
  return newestArtifacts(artifacts).filter(
    (artifact) => (!projectId || artifact.projectId === projectId) && (!source || sourceOf(artifact) === source),
  );
}

export function upsertArtifact(artifacts: readonly Artifact[] | null | undefined, artifact: Artifact): Artifact[] {
  return newestArtifacts([artifact, ...(artifacts ?? []).filter((item) => item.id !== artifact.id)]);
}

export function removeArtifact(artifacts: readonly Artifact[] | null | undefined, id: string): Artifact[] {
  return (artifacts ?? []).filter((artifact) => artifact.id !== id);
}

export function findArtifact(artifacts: readonly Artifact[] | null | undefined, id: string): Artifact | null {
  return (artifacts ?? []).find((artifact) => artifact.id === id) ?? null;
}

export function projectOptions(items: readonly { projectId: string }[] | null | undefined, names: Record<string, string>): ChoiceOption[] {
  const ids = new Set<string>(Object.keys(names));
  for (const item of items ?? []) if (item.projectId) ids.add(item.projectId);
  const label = (id: string) => names[id] ?? id;
  const ordered = [...ids].sort((a, b) => {
    const left = label(a).toLowerCase();
    const right = label(b).toLowerCase();
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return [{ id: ALL, label: FILES_LABELS.allProjects }, ...ordered.map((id) => ({ id, label: label(id) }))];
}

export function sourceOptions(): ChoiceOption[] {
  return [
    { id: ALL, label: FILES_LABELS.allSources },
    { id: "build", label: SOURCE_LABELS.build },
    { id: "agent", label: SOURCE_LABELS.agent },
  ];
}

export function resolveOption(options: readonly ChoiceOption[], value: string): string {
  return options.some((option) => option.id === value) ? value : (options[0]?.id ?? ALL);
}

export function onlineTargets(taildrop: TaildropTargets | null | undefined): TaildropTarget[] {
  if (!taildrop?.available) return [];
  return taildrop.targets
    .filter((target) => target.online)
    .sort((a, b) => {
      const left = (a.hostName ?? "").toLowerCase();
      const right = (b.hostName ?? "").toLowerCase();
      return left < right ? -1 : left > right ? 1 : 0;
    });
}

export function targetLabel(target: TaildropTarget): string {
  return joinMeta(target.hostName || target.id, target.os);
}

export function taildropAvailable(taildrop: TaildropTargets | null | undefined): boolean {
  return Boolean(taildrop?.available);
}

export function isMissing(error: unknown): boolean {
  return (error instanceof ApiError && error.status === 404) || (error instanceof IpcError && error.code === "not_found");
}

export function isFileView(value: unknown): value is FileView {
  return typeof value === "string" && (FILE_VIEWS as readonly string[]).includes(value);
}

export function viewTabs(artifacts: readonly Artifact[] | null, outputs: readonly BuildOutput[] | null): PillTab[] {
  return [
    { id: "shared", label: VIEW_LABELS.shared, count: artifacts?.length ?? null },
    { id: "builds", label: VIEW_LABELS.builds, count: outputs?.length ?? null },
  ];
}

export function outputKey(output: Pick<BuildOutput, "projectId" | "path">): string {
  return `${output.projectId}/${output.path}`;
}

export function outputFolder(output: Pick<BuildOutput, "path" | "fileName">): string {
  return output.path.slice(0, Math.max(0, output.path.length - output.fileName.length - 1)) || ".";
}

export function outputMeta(output: BuildOutput, now?: number): string {
  const platform = output.platform && output.platform !== OUTPUT_PLATFORM_HIDDEN ? output.platform : null;
  return joinMeta(formatBytes(output.sizeBytes), platform, formatRelativeTime(output.modifiedAt, now));
}

export function filterOutputs(outputs: readonly BuildOutput[] | null | undefined, projectId: string = ALL): BuildOutput[] {
  return [...(outputs ?? [])]
    .sort(byTimeDesc((output) => output.modifiedAt))
    .filter((output) => !projectId || output.projectId === projectId);
}

export function sharedEmptyCopy(total: number): EmptyCopy {
  return total > 0 ? { title: FILES_LABELS.noMatch, message: null } : { title: FILES_LABELS.emptyTitle, message: FILES_LABELS.empty };
}

export function buildsEmptyCopy(total: number): EmptyCopy {
  return total > 0 ? { title: OUTPUT_LABELS.noMatch, message: null } : { title: OUTPUT_LABELS.emptyTitle, message: OUTPUT_LABELS.empty };
}
