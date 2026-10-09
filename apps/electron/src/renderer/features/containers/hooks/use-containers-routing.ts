import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { SEARCH_PARAM } from "../../../../shared/routes";
import { useNavigateTo, usePageParams, usePreferencesRoute } from "../../../app/navigation";
import { CONTAINERS_PREFERENCES, CREATE_DIALOG_PARAM } from "../constants";

export interface ContainersPageParams {
  create?: boolean;
}

export function containerNameFromPath(splat: string): string | null {
  return decodeURIComponent(splat.split("/")[0] ?? "") || null;
}

export function useContainersRouting() {
  const navigate = useNavigateTo();
  const name = containerNameFromPath(useParams()["*"] ?? "");
  const { params, at } = usePageParams<ContainersPageParams>();
  const [search] = useSearchParams();
  const { openPreferences } = usePreferencesRoute();
  const [createOpen, setCreateOpen] = useState(() => search.get(SEARCH_PARAM.dialog) === CREATE_DIALOG_PARAM);

  const openContainer = useCallback((target: string) => navigate("containers", undefined, encodeURIComponent(target)), [navigate]);
  const back = useCallback(() => navigate("containers"), [navigate]);
  const openCreate = useCallback(() => setCreateOpen(true), []);
  const closeCreate = useCallback(() => setCreateOpen(false), []);
  const openSettings = useCallback(() => openPreferences(CONTAINERS_PREFERENCES), [openPreferences]);

  useEffect(() => {
    if (at === null || !params) return;
    if (params.create) setCreateOpen(true);
  }, [at]);

  return { name, createOpen, openCreate, closeCreate, openContainer, back, openSettings };
}
