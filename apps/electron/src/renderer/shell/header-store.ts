import { useEffect, useId, type ReactNode } from "react";
import { create } from "zustand";

export interface PageHeaderState {
  parent: string | null;
  title: string | null;
  actions: ReactNode;
  onBack: (() => void) | null;
}

interface HeaderStore extends PageHeaderState {
  owner: string | null;
  set(state: Partial<PageHeaderState>, owner?: string): void;
  reset(owner?: string): void;
}

const EMPTY: PageHeaderState = { parent: null, title: null, actions: null, onBack: null };

export const useHeaderStore = create<HeaderStore>((set) => ({
  ...EMPTY,
  owner: null,
  set: (state, owner) => set(owner === undefined ? state : { ...state, owner }),
  reset: (owner) => set((current) => (owner === undefined || current.owner === owner ? { ...EMPTY, owner: null } : current)),
}));

export function usePageHeader({ parent = null, title = null, actions = null, onBack = null }: Partial<PageHeaderState>): void {
  const owner = useId();
  const setHeader = useHeaderStore((state) => state.set);
  const reset = useHeaderStore((state) => state.reset);
  useEffect(() => setHeader({ parent, title, actions, onBack }, owner), [parent, title, actions, onBack, owner, setHeader]);
  useEffect(() => () => reset(owner), [owner, reset]);
}
