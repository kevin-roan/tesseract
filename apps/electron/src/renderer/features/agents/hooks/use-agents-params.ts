import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { usePageParams } from "../../../app/navigation";
import { AGENT_FILTERS, NEW_SUBROUTE, SEARCH_KEYS, type AgentFilter } from "../constants";
import { useAgentsUi } from "../store";
import type { StartRunInput } from "./use-start-run";

export interface AgentsParams {
  runId?: string;
  prompt?: string;
  send?: boolean;
  projectId?: string | null;
  attachmentIds?: string[];
  new?: boolean;
  search?: boolean;
  filter?: string;
}

const isFilter = (value: unknown): value is AgentFilter => (AGENT_FILTERS as readonly unknown[]).includes(value);

export function applyAgentsParams(params: AgentsParams, start: (input: StartRunInput) => unknown): void {
  const ui = useAgentsUi.getState();
  if (params.runId) {
    ui.select(params.runId);
    return;
  }
  if (params.prompt && params.send) {
    ui.openNew({ prompt: params.prompt, projectId: params.projectId ?? "" });
    void start({ prompt: params.prompt, projectId: params.projectId, attachmentIds: params.attachmentIds });
    return;
  }
  if (params.new || params.prompt !== undefined || params.projectId !== undefined) {
    ui.openNew({
      ...(params.prompt !== undefined ? { prompt: params.prompt } : {}),
      ...(params.projectId !== undefined ? { projectId: params.projectId ?? "" } : {}),
    });
    return;
  }
  if (params.search) {
    ui.revealList();
    ui.setSearchOpen(true);
    return;
  }
  if (isFilter(params.filter)) {
    ui.setFilter(params.filter);
    ui.revealList();
  }
}

export function isOneShot(params: AgentsParams | null): boolean {
  return Boolean(params?.prompt && params.send);
}

export function paramsFromSubroute(sub: string): AgentsParams | null {
  const segment = sub.split("/")[0] ?? "";
  if (!segment) return null;
  return segment === NEW_SUBROUTE ? { new: true } : { runId: decodeURIComponent(segment) };
}

export function paramsFromSearch(search: URLSearchParams): AgentsParams | null {
  const filter = search.get(SEARCH_KEYS.filter);
  if (filter) return { filter };
  return search.has(SEARCH_KEYS.search) ? { search: true } : null;
}

export function useAgentsParams(start: (input: StartRunInput) => unknown, ready: boolean): void {
  const { params, at } = usePageParams<AgentsParams>();
  const sub = useParams()["*"] ?? "";
  const [search] = useSearchParams();
  const query = search.toString();
  const location = useLocation();
  const navigate = useNavigate();
  const pending = useRef<AgentsParams | null>(null);
  const latest = useRef({ params, start, sub, search, location, navigate, ready });
  latest.current = { params, start, sub, search, location, navigate, ready };

  const flush = useRef(() => {
    const current = latest.current;
    const oneShot = pending.current;
    if (!oneShot || !current.ready) return;
    pending.current = null;
    applyAgentsParams(oneShot, current.start);
    const { pathname, search: locationSearch } = current.location;
    current.navigate({ pathname, search: locationSearch }, { replace: true, state: null });
  });

  useEffect(() => {
    const current = latest.current;
    const fromSearch = paramsFromSearch(current.search);
    if (fromSearch) applyAgentsParams(fromSearch, current.start);
    const given = at !== null ? current.params : null;
    if (isOneShot(given)) {
      pending.current = given;
      flush.current();
      return;
    }
    const next = given ?? paramsFromSubroute(current.sub);
    if (next) applyAgentsParams(next, current.start);
  }, [at, sub, query]);

  useEffect(() => {
    if (ready) flush.current();
  }, [ready]);
}
