import { create } from "zustand";

import type { SandboxIssue, SandboxLink } from "../types";

type ConnectionStore = {
  links: Record<string, SandboxLink>;
  issues: Record<string, SandboxIssue>;
  setLink: (sandboxId: string, link: SandboxLink) => void;
  setIssue: (sandboxId: string, issue: SandboxIssue | null) => void;
  clearLink: (sandboxId: string) => void;
};

const without = <T>(record: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([id]) => id !== key));

export const useConnectionStore = create<ConnectionStore>()((set) => ({
  links: {},
  issues: {},
  setLink: (sandboxId, link) =>
    set((state) => (state.links[sandboxId] === link ? state : { links: { ...state.links, [sandboxId]: link } })),
  setIssue: (sandboxId, issue) =>
    set((state) => {
      if ((state.issues[sandboxId] ?? null) === issue) return state;
      return { issues: issue ? { ...state.issues, [sandboxId]: issue } : without(state.issues, sandboxId) };
    }),
  clearLink: (sandboxId) =>
    set((state) => ({ links: without(state.links, sandboxId), issues: without(state.issues, sandboxId) })),
}));
