import { create } from "zustand";
import type { LiveSession } from "./types";

export interface TerminalsUiState {
  selectedId: string | null;
  attached: string[];
  hidden: string[];
  live: Record<string, LiveSession>;
  creating: boolean;
  drawerOpen: boolean;
  confirmId: string | null;
  setSelected(id: string | null): void;
  setAttached(ids: string[]): void;
  hide(id: string): void;
  unhide(id: string): void;
  patchLive(id: string, patch: Partial<LiveSession>): void;
  dropLive(id: string): void;
  setCreating(creating: boolean): void;
  setDrawerOpen(open: boolean): void;
  setConfirmId(id: string | null): void;
  reset(): void;
}

export const INITIAL_LIVE: LiveSession = {
  state: "connecting",
  exitCode: null,
  error: null,
  title: null,
  cols: 0,
  rows: 0,
  hasSelection: false,
};

const initial = {
  selectedId: null,
  attached: [],
  hidden: [],
  live: {},
  creating: false,
  drawerOpen: false,
  confirmId: null,
};

export const useTerminalsUi = create<TerminalsUiState>((set) => ({
  ...initial,
  setSelected: (selectedId) => set({ selectedId }),
  setAttached: (attached) => set({ attached }),
  hide: (id) => set((state) => (state.hidden.includes(id) ? state : { hidden: [...state.hidden, id] })),
  unhide: (id) => set((state) => (state.hidden.includes(id) ? { hidden: state.hidden.filter((candidate) => candidate !== id) } : state)),
  patchLive: (id, patch) =>
    set((state) => ({ live: { ...state.live, [id]: { ...(state.live[id] ?? INITIAL_LIVE), ...patch } } })),
  dropLive: (id) =>
    set((state) => {
      if (!(id in state.live)) return state;
      const { [id]: _removed, ...rest } = state.live;
      return { live: rest };
    }),
  setCreating: (creating) => set({ creating }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setConfirmId: (confirmId) => set({ confirmId }),
  reset: () => set(initial),
}));
