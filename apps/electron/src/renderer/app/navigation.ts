import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ROUTE, SEARCH_PARAM, type PageId, type PreferencesSectionId } from "../../shared/routes";

export interface PageNavigationState<T = Record<string, unknown>> {
  params?: T;
  at: number;
}

export function useNavigateTo() {
  const navigate = useNavigate();
  return useCallback(
    (page: PageId, params?: Record<string, unknown>, sub = "") => {
      const state: PageNavigationState = { params, at: Date.now() };
      navigate(ROUTE.page(page, sub), { state });
    },
    [navigate],
  );
}

export function usePageParams<T = Record<string, unknown>>(): { params: T | null; at: number | null } {
  const state = useLocation().state as PageNavigationState<T> | null;
  return { params: state?.params ?? null, at: state?.at ?? null };
}

export function usePreferencesRoute() {
  const [search, setSearch] = useSearchParams();
  const section = search.get(SEARCH_PARAM.preferences);
  const open = useCallback(
    (id?: PreferencesSectionId) =>
      setSearch((current) => {
        const next = new URLSearchParams(current);
        next.set(SEARCH_PARAM.preferences, id ?? "");
        return next;
      }),
    [setSearch],
  );
  const close = useCallback(
    () =>
      setSearch((current) => {
        const next = new URLSearchParams(current);
        next.delete(SEARCH_PARAM.preferences);
        return next;
      }),
    [setSearch],
  );
  return { open: section !== null, section: section || null, openPreferences: open, closePreferences: close };
}
