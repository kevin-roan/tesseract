import { create } from "zustand";
import type { DeleteAgentRuns } from "@tesseract/protocol";
import { ALL_PROJECTS_KEY, DEFAULT_MODEL_KEY, NO_PROJECT_KEY, type AgentFilter, type DetailView } from "./constants";
import type { ModelKey } from "./model";

export interface NewDraft {
  prompt: string;
  projectId: string;
  model: ModelKey;
}

export interface PendingDelete {
  body: DeleteAgentRuns;
  ids: readonly string[];
  count: number;
}

export interface AgentsUiState {
  filter: AgentFilter;
  projectFilter: string;
  query: string;
  searchOpen: boolean;
  view: DetailView;
  selectedRunId: string | null;
  sidebarOpen: boolean;
  draft: NewDraft;
  focusToken: number;
  selectToken: number;
  searchFocusToken: number;
  revealToken: number;
  pendingDelete: PendingDelete | null;
}

export interface AgentsUiActions {
  setFilter(filter: AgentFilter): void;
  setProjectFilter(projectFilter: string): void;
  setQuery(query: string): void;
  setSearchOpen(open: boolean): void;
  select(runId: string): void;
  openNew(draft?: Partial<NewDraft>): void;
  closeDetail(): void;
  setSidebarOpen(open: boolean): void;
  revealList(): void;
  setDraft(patch: Partial<NewDraft>): void;
  resetDraft(): void;
  setPendingDelete(pending: PendingDelete | null): void;
}

export const EMPTY_DRAFT: NewDraft = { prompt: "", projectId: NO_PROJECT_KEY, model: DEFAULT_MODEL_KEY };

export const INITIAL_AGENTS_UI: AgentsUiState = {
  filter: "all",
  projectFilter: ALL_PROJECTS_KEY,
  query: "",
  searchOpen: false,
  view: "empty",
  selectedRunId: null,
  sidebarOpen: true,
  draft: EMPTY_DRAFT,
  focusToken: 0,
  selectToken: 0,
  searchFocusToken: 0,
  revealToken: 0,
  pendingDelete: null,
};

export const useAgentsUi = create<AgentsUiState & AgentsUiActions>((set) => ({
  ...INITIAL_AGENTS_UI,
  setFilter: (filter) => set({ filter }),
  setProjectFilter: (projectFilter) => set({ projectFilter }),
  setQuery: (query) => set({ query }),
  setSearchOpen: (open) =>
    set((state) => ({
      searchOpen: open,
      query: open ? state.query : "",
      searchFocusToken: open ? state.searchFocusToken + 1 : state.searchFocusToken,
    })),
  select: (runId) => set((state) => ({ selectedRunId: runId, view: "conversation", selectToken: state.selectToken + 1 })),
  openNew: (draft) =>
    set((state) => ({
      view: "new",
      selectedRunId: null,
      draft: draft ? { ...state.draft, ...draft } : state.draft,
      focusToken: state.focusToken + 1,
    })),
  closeDetail: () => set({ view: "empty", selectedRunId: null }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  revealList: () => set((state) => ({ sidebarOpen: true, revealToken: state.revealToken + 1 })),
  setDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  resetDraft: () => set((state) => ({ draft: { ...EMPTY_DRAFT, model: state.draft.model } })),
  setPendingDelete: (pendingDelete) => set({ pendingDelete }),
}));

export function resetAgentsUi(): void {
  useAgentsUi.setState(INITIAL_AGENTS_UI);
}
