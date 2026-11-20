import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PANEL_SIZE } from "./constants";
import type { PanelPlacement } from "./panel-model";

interface TerminalPanelState {
  placement: PanelPlacement;
  sizes: Record<PanelPlacement, number>;
  openProjects: string[];
  setOpen(projectId: string, open: boolean): void;
  setPlacement(placement: PanelPlacement): void;
  setSize(placement: PanelPlacement, size: number): void;
}

export const useTerminalPanelStore = create<TerminalPanelState>()(
  persist(
    (set) => ({
      placement: "bottom",
      sizes: { bottom: PANEL_SIZE.bottom.default, right: PANEL_SIZE.right.default },
      openProjects: [],
      setOpen: (projectId, open) =>
        set((state) => {
          if (state.openProjects.includes(projectId) === open) return state;
          return { openProjects: open ? [...state.openProjects, projectId] : state.openProjects.filter((id) => id !== projectId) };
        }),
      setPlacement: (placement) => set({ placement }),
      setSize: (placement, size) => set((state) => ({ sizes: { ...state.sizes, [placement]: size } })),
    }),
    {
      name: "tesseract.project-terminal-panel",
      partialize: ({ placement, sizes }) => ({ placement, sizes }),
    },
  ),
);
