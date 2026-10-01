import type { Artifact, ArtifactSource } from "@theone/protocol";

import type { ChoiceOption } from "@/components/choice-group";
import { newestFirst } from "@/features/sandbox/utils/collections";

import { ALL_PROJECTS } from "./constants";

export type SourceFilter = "all" | ArtifactSource;

export type FileFilters = { projectId: string | null; source: SourceFilter };

export const DEFAULT_FILE_FILTERS: FileFilters = { projectId: null, source: "all" };

export const SOURCE_FILTERS: readonly { id: SourceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "agent", label: "Shared by Claude" },
  { id: "build", label: "Builds" },
];

export const isSourceFilter = (value: string): value is SourceFilter =>
  SOURCE_FILTERS.some((option) => option.id === value);

export function filterFiles(artifacts: readonly Artifact[], { projectId, source }: FileFilters): Artifact[] {
  return newestFirst(
    artifacts.filter(
      (artifact) => (!projectId || artifact.projectId === projectId) && (source === "all" || artifact.source === source),
    ),
    (artifact) => artifact.createdAt,
  );
}

export function projectFilterOptions(
  artifacts: readonly Artifact[],
  names: ReadonlyMap<string, string>,
): ChoiceOption[] {
  const ids = [...new Set(artifacts.map((artifact) => artifact.projectId))];
  if (ids.length < 2) return [];
  const options = ids
    .map((id) => ({ id, label: names.get(id) ?? id }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [{ id: ALL_PROJECTS, label: "All projects" }, ...options];
}

export const projectFilterId = (value: string): string | null => (value === ALL_PROJECTS ? null : value);
