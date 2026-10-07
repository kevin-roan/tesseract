import { create } from "zustand";

interface PaletteState {
  open: boolean;
  query: string;
  recent: string[];
  openPalette(query?: string): void;
  close(): void;
  toggle(): void;
  setQuery(query: string): void;
  remember(id: string, limit: number): void;
}

export const usePaletteStore = create<PaletteState>((set) => ({
  open: false,
  query: "",
  recent: [],
  openPalette: (query = "") => set({ open: true, query }),
  close: () => set({ open: false }),
  toggle: () => set((state) => (state.open ? { open: false } : { open: true, query: "" })),
  setQuery: (query) => set({ query }),
  remember: (id, limit) => set((state) => ({ recent: [id, ...state.recent.filter((item) => item !== id)].slice(0, limit) })),
}));

export const openCommandPalette = (query?: string) => usePaletteStore.getState().openPalette(query);
export const closeCommandPalette = () => usePaletteStore.getState().close();
export const toggleCommandPalette = () => usePaletteStore.getState().toggle();
