import { useCallback, useMemo } from "react";

import { useScriptBookmarksStore } from "../store/script-bookmarks-store";

const NONE: string[] = [];

export function useScriptBookmarks(projectId: string) {
  const bookmarked = useScriptBookmarksStore((state) => state.bookmarks[projectId] ?? NONE);
  const toggleBookmark = useScriptBookmarksStore((state) => state.toggleBookmark);
  const set = useMemo(() => new Set(bookmarked), [bookmarked]);

  return {
    isBookmarked: useCallback((script: string) => set.has(script), [set]),
    toggle: useCallback((script: string) => toggleBookmark(projectId, script), [projectId, toggleBookmark]),
  };
}
