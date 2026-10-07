import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { SEARCH_PARAM } from "../../../../shared/routes";
import { useNavigateTo, usePageParams } from "../../../app/navigation";
import { CREATE_DIALOG_PARAM, PROJECT_TABS, TAB_SEARCH_PARAM } from "../constants";
import type { ProjectTabId } from "../types";

export interface ProjectsPageParams {
  create?: boolean;
  projectId?: string;
  tab?: string;
}

export function isProjectTab(value: unknown): value is ProjectTabId {
  return typeof value === "string" && (PROJECT_TABS as readonly string[]).includes(value);
}

export function useProjectsRouting() {
  const navigate = useNavigateTo();
  const splat = useParams()["*"] ?? "";
  const projectId = decodeURIComponent(splat.split("/")[0] ?? "") || null;
  const { params, at } = usePageParams<ProjectsPageParams>();
  const [search] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(() => search.get(SEARCH_PARAM.dialog) === CREATE_DIALOG_PARAM);

  const openProject = useCallback(
    (id: string, tab?: ProjectTabId) => navigate("projects", tab ? { tab } : undefined, encodeURIComponent(id)),
    [navigate],
  );
  const back = useCallback(() => navigate("projects"), [navigate]);
  const askClaude = useCallback((id?: string) => navigate("agents", id ? { new: true, projectId: id } : { new: true }), [navigate]);
  const openCreate = useCallback(() => setCreateOpen(true), []);
  const closeCreate = useCallback(() => setCreateOpen(false), []);

  useEffect(() => {
    if (at === null || !params) return;
    if (params.create) setCreateOpen(true);
    const target = typeof params.projectId === "string" ? params.projectId.trim() : "";
    if (target && target !== projectId) openProject(target, isProjectTab(params.tab) ? params.tab : undefined);
  }, [at]);

  const searchTab = search.get(TAB_SEARCH_PARAM);
  const initialTab = isProjectTab(params?.tab) ? params.tab : isProjectTab(searchTab) ? searchTab : null;

  return { projectId, initialTab, tabAt: at, createOpen, openCreate, closeCreate, openProject, back, askClaude, navigate };
}
