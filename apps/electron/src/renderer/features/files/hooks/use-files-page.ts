import type { Artifact, BuildOutput } from "@theone/protocol";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useShallow } from "zustand/react/shallow";
import { usePageParams } from "../../../app/navigation";
import type { ChoiceOption } from "../../../components/ChoiceDropdown";
import type { PillTab } from "../../../components/PillTabs";
import { useWorkspaceProjects } from "../../projects/hooks/use-workspace";
import type { FileView } from "../constants";
import {
  buildsEmptyCopy,
  byProject,
  filterArtifacts,
  filterOutputs,
  isFileView,
  projectNames,
  projectOptions,
  resolveOption,
  sharedEmptyCopy,
  sourceOptions,
  viewTabs,
  type EmptyCopy,
  type FileGroup,
} from "../model";
import { filesStore, useFilesStore } from "../store";
import { useFileActions, type FileActions } from "./use-file-actions";
import { useFilesData } from "./use-files-data";
import { useFilesNotice, type FilesNotice } from "./use-files-notice";

export interface FilesParams {
  view?: unknown;
  artifactId?: unknown;
  projectId?: unknown;
}

export interface FilterState {
  options: ChoiceOption[];
  value: string;
  onChange(value: string): void;
}

export interface FilesPageModel {
  status: "loading" | "error" | "content";
  error: string | null;
  view: FileView;
  setView(view: string): void;
  tabs: PillTab[];
  projectFilter: FilterState;
  sourceFilter: FilterState;
  outputFilter: FilterState;
  shared: { groups: FileGroup<Artifact>[]; empty: EmptyCopy };
  builds: { status: "loading" | "error" | "content"; error: string | null; groups: FileGroup<BuildOutput>[]; empty: EmptyCopy };
  notice: FilesNotice;
  actions: FileActions;
  refresh(): void;
}

export function useFilesPage(): FilesPageModel {
  const notice = useFilesNotice();
  const data = useFilesData(notice.report);
  const actions = useFileActions(notice.report, data.removeArtifact);
  const { projects } = useWorkspaceProjects();
  const sub = useParams()["*"] ?? "";
  const navigate = useNavigate();
  const location = useLocation();
  const { view: storedView, project, source, outputProject } = useFilesStore(
    useShallow((state) => ({ view: state.view, project: state.project, source: state.source, outputProject: state.outputProject })),
  );
  const routeView = useRef(isFileView(sub) ? sub : null);
  const view = routeView.current ?? storedView;
  const setProject = useCallback((value: string) => filesStore.setFilters({ project: value }), []);
  const setSource = useCallback((value: string) => filesStore.setFilters({ source: value }), []);
  const setOutputProject = useCallback((value: string) => filesStore.setFilters({ outputProject: value }), []);

  const names = useMemo(() => projectNames(projects), [projects]);
  const sharedOptions = useMemo(() => projectOptions(data.artifacts, names), [data.artifacts, names]);
  const outputOptions = useMemo(() => projectOptions(data.outputs, names), [data.outputs, names]);
  const sources = useMemo(() => sourceOptions(), []);
  const projectValue = resolveOption(sharedOptions, project);
  const outputValue = resolveOption(outputOptions, outputProject);

  const sharedGroups = useMemo(
    () => byProject(filterArtifacts(data.artifacts, projectValue, source), names),
    [data.artifacts, projectValue, source, names],
  );
  const outputGroups = useMemo(() => byProject(filterOutputs(data.outputs, outputValue), names), [data.outputs, outputValue, names]);

  const setView = useCallback((next: string) => {
    if (!isFileView(next)) return;
    routeView.current = null;
    filesStore.setFilters({ view: next });
  }, []);

  const refresh = useCallback(() => data.refresh(view === "builds"), [data, view]);

  useEffect(() => {
    if (isFileView(sub)) setView(sub);
  }, [sub, setView]);

  const { params, at } = usePageParams<FilesParams>();
  const latest = useRef({ actions, artifacts: data.artifacts });
  latest.current = { actions, artifacts: data.artifacts };
  const consume = useRef({ navigate, location });
  consume.current = { navigate, location };
  useEffect(() => {
    if (!params || at === null || !filesStore.claimNavigation(at)) return;
    const { navigate: go, location: here } = consume.current;
    go({ pathname: here.pathname, search: here.search }, { replace: true, state: null });
    if (isFileView(params.view)) setView(params.view);
    if (typeof params.artifactId === "string" && params.artifactId) {
      const projectId = typeof params.projectId === "string" && params.projectId ? params.projectId : null;
      latest.current.actions.saveById(params.artifactId, projectId, latest.current.artifacts);
    }
  }, [params, at, setView]);

  const status = data.artifacts ? "content" : data.artifactsError ? "error" : "loading";
  const buildsStatus = data.outputs ? "content" : data.outputsError ? "error" : "loading";

  return {
    status,
    error: data.artifactsError,
    view,
    setView,
    tabs: viewTabs(data.artifacts, data.outputs),
    projectFilter: { options: sharedOptions, value: projectValue, onChange: setProject },
    sourceFilter: { options: sources, value: source, onChange: setSource },
    outputFilter: { options: outputOptions, value: outputValue, onChange: setOutputProject },
    shared: { groups: sharedGroups, empty: sharedEmptyCopy(data.artifacts?.length ?? 0) },
    builds: { status: buildsStatus, error: data.outputsError, groups: outputGroups, empty: buildsEmptyCopy(data.outputs?.length ?? 0) },
    notice,
    actions,
    refresh,
  };
}
