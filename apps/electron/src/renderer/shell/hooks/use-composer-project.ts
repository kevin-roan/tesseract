import { create } from "zustand";

interface ComposerProjectStore {
  projectId: string | null;
  setProjectId(projectId: string | null): void;
}

export const useComposerProject = create<ComposerProjectStore>((set) => ({
  projectId: null,
  setProjectId: (projectId) => set({ projectId }),
}));
