import type { Artifact, BuildOutput, TaildropTargets } from "@theone/protocol";
import { create } from "zustand";
import { ALL, DEFAULT_VIEW, type FileView } from "./constants";

export type DownloadState = Readonly<Record<string, number | null>>;

interface ScopedData {
  scope: string | null;
  artifacts: Artifact[] | null;
  outputs: BuildOutput[] | null;
  artifactsError: string | null;
  outputsError: string | null;
  taildrop: TaildropTargets | null;
}

export interface FilesFilters {
  view: FileView;
  project: string;
  source: string;
  outputProject: string;
}

export interface FilesState extends ScopedData, FilesFilters {
  downloads: DownloadState;
  handledNavigation: number | null;
}

const EMPTY_DATA: Omit<ScopedData, "scope"> = {
  artifacts: null,
  outputs: null,
  artifactsError: null,
  outputsError: null,
  taildrop: null,
};

const INITIAL_STATE: FilesState = {
  scope: null,
  ...EMPTY_DATA,
  view: DEFAULT_VIEW,
  project: ALL,
  source: ALL,
  outputProject: ALL,
  downloads: {},
  handledNavigation: null,
};

const claimed = new Set<string>();

export const useFilesStore = create<FilesState>(() => INITIAL_STATE);

function updateScoped(scope: string, patch: (state: FilesState) => Partial<ScopedData>): void {
  useFilesStore.setState((state) => {
    const base = state.scope === scope ? state : { ...state, ...EMPTY_DATA, scope };
    return { ...base, ...patch(base) };
  });
}

export function scopedData(state: FilesState, scope: string | null): Omit<ScopedData, "scope"> {
  if (scope === null || state.scope !== scope) return EMPTY_DATA;
  return state;
}

export const filesStore = {
  setArtifacts: (scope: string, artifacts: Artifact[]) => updateScoped(scope, () => ({ artifacts, artifactsError: null })),
  updateArtifacts: (scope: string, update: (current: Artifact[]) => Artifact[]) =>
    updateScoped(scope, (state) => ({ artifacts: state.artifacts ? update(state.artifacts) : state.artifacts })),
  setArtifactsError: (scope: string, artifactsError: string | null) => updateScoped(scope, () => ({ artifactsError })),
  setOutputs: (scope: string, outputs: BuildOutput[]) => updateScoped(scope, () => ({ outputs, outputsError: null })),
  setOutputsError: (scope: string, outputsError: string | null) => updateScoped(scope, () => ({ outputsError })),
  setTaildrop: (scope: string, taildrop: TaildropTargets) => updateScoped(scope, () => ({ taildrop })),
  setFilters: (patch: Partial<FilesFilters>) => useFilesStore.setState(patch),
  claimNavigation(at: number): boolean {
    if (useFilesStore.getState().handledNavigation === at) return false;
    useFilesStore.setState({ handledNavigation: at });
    return true;
  },
  claimDownload(key: string): boolean {
    if (claimed.has(key)) return false;
    claimed.add(key);
    return true;
  },
  startDownload: (key: string) => useFilesStore.setState((state) => ({ downloads: { ...state.downloads, [key]: null } })),
  setProgress(key: string, fraction: number) {
    useFilesStore.setState((state) => (key in state.downloads ? { downloads: { ...state.downloads, [key]: fraction } } : state));
  },
  finishDownload(key: string) {
    claimed.delete(key);
    useFilesStore.setState((state) => {
      const { [key]: _removed, ...rest } = state.downloads;
      return { downloads: rest };
    });
  },
};

export function resetFilesStore(): void {
  claimed.clear();
  useFilesStore.setState(INITIAL_STATE, true);
}
