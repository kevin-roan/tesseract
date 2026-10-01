import { create } from "zustand";

import type { SharedItem } from "@/modules/theone-island";

import type { AttachDraft, CaptureSeed } from "../types";

export type IslandStore = {
  expanded: boolean;
  pendingDraft: AttachDraft | null;
  sharedItems: SharedItem[];
  captureOpen: boolean;
  captureSeed: CaptureSeed | null;
  attachOpen: boolean;
  /** Draft being previewed in the attach-target sheet before a destination is picked. */
  stagedDraft: AttachDraft | null;
  setExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
  openCapture: (seed?: CaptureSeed | null) => void;
  closeCapture: () => void;
  openAttach: (draft: AttachDraft) => void;
  closeAttach: () => void;
  queueSharedItems: (items: SharedItem[]) => void;
  takeSharedItems: () => SharedItem[];
  setPendingDraft: (draft: AttachDraft | null) => void;
  takePendingDraft: () => AttachDraft | null;
  reset: () => void;
};

const initial = {
  expanded: false,
  pendingDraft: null,
  sharedItems: [],
  captureOpen: false,
  captureSeed: null,
  attachOpen: false,
  stagedDraft: null,
};

export const useIslandStore = create<IslandStore>()((set, get) => ({
  ...initial,
  setExpanded: (expanded) => set({ expanded }),
  toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
  openCapture: (seed = null) => set({ captureOpen: true, captureSeed: seed, attachOpen: false, expanded: false }),
  closeCapture: () => set({ captureOpen: false, captureSeed: null }),
  openAttach: (draft) => set({ stagedDraft: draft, attachOpen: true, captureOpen: false, expanded: false }),
  closeAttach: () => set({ attachOpen: false, stagedDraft: null }),
  queueSharedItems: (items) => {
    if (items.length === 0) return;
    set((state) => ({ sharedItems: [...state.sharedItems, ...items] }));
  },
  takeSharedItems: () => {
    const items = get().sharedItems;
    if (items.length > 0) set({ sharedItems: [] });
    return items;
  },
  setPendingDraft: (pendingDraft) => set({ pendingDraft }),
  takePendingDraft: () => {
    const draft = get().pendingDraft;
    if (draft) set({ pendingDraft: null });
    return draft;
  },
  reset: () => set(initial),
}));

export const selectHasPendingWork = (state: IslandStore): boolean =>
  state.sharedItems.length > 0 || state.pendingDraft !== null;
