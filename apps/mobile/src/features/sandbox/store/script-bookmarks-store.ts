import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { SCRIPT_BOOKMARKS_STORE_NAME, SCRIPT_BOOKMARKS_STORE_VERSION } from "../utils/constants";
import { listStorage } from "./list-storage";

type ScriptBookmarks = { bookmarks: Record<string, string[]> };

export type ScriptBookmarksStore = ScriptBookmarks & {
  toggleBookmark: (projectId: string, script: string) => void;
};

const isBookmarks = (value: unknown): value is Record<string, string[]> =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((scripts) => Array.isArray(scripts) && scripts.every((s) => typeof s === "string"));

export const useScriptBookmarksStore = create<ScriptBookmarksStore>()(
  persist(
    (set) => ({
      bookmarks: {},
      toggleBookmark: (projectId, script) =>
        set(({ bookmarks }) => {
          const current = bookmarks[projectId] ?? [];
          const next = current.includes(script) ? current.filter((name) => name !== script) : [...current, script];
          return { bookmarks: { ...bookmarks, [projectId]: next } };
        }),
    }),
    {
      name: SCRIPT_BOOKMARKS_STORE_NAME,
      version: SCRIPT_BOOKMARKS_STORE_VERSION,
      storage: createJSONStorage(() => listStorage),
      partialize: ({ bookmarks }): ScriptBookmarks => ({ bookmarks }),
      merge: (persisted, current) => {
        const bookmarks = (persisted as Partial<ScriptBookmarks> | undefined)?.bookmarks;
        return isBookmarks(bookmarks) ? { ...current, bookmarks } : current;
      },
    },
  ),
);
