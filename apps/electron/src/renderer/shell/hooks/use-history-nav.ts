import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router";
import { create } from "zustand";
import type { MenuSections } from "../../components/ActionMenu";
import { pageKeyOf } from "../../app/feedback";
import { findPage } from "../../app/registry/pages";
import type { IconName } from "../../theme/icons";
import { SHELL } from "../constants";
import { useHeaderStore } from "../header-store";

export interface RecentPlace {
  path: string;
  title: string;
  icon?: IconName;
}

interface HistoryStore {
  /** Furthest history index reached, so forward stays enabled after going back. */
  maxIndex: number;
  recent: readonly RecentPlace[];
  record(index: number, push: boolean): void;
  visit(place: RecentPlace): void;
}

const useHistoryStore = create<HistoryStore>((set) => ({
  maxIndex: 0,
  recent: [],
  record: (index, push) => set((state) => ({ maxIndex: push ? index : Math.max(state.maxIndex, index) })),
  visit: (place) =>
    set((state) => ({
      recent: [place, ...state.recent.filter((entry) => entry.path !== place.path)].slice(0, SHELL.recentPlaces),
    })),
}));

function historyIndex(): number {
  const state = globalThis.history?.state as { idx?: number } | null;
  return typeof state?.idx === "number" ? state.idx : 0;
}

/** Linear-style titlebar navigation: back, forward, and a menu of recently visited pages. */
export function useHistoryNav() {
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { key, pathname } = useLocation();
  const headerTitle = useHeaderStore((state) => state.title);
  const { maxIndex, recent, record, visit } = useHistoryStore();
  const index = historyIndex();

  useEffect(() => record(historyIndex(), navigationType === "PUSH"), [key, navigationType, record]);

  useEffect(() => {
    const page = findPage(pageKeyOf(pathname));
    if (!page) return;
    const title = headerTitle && headerTitle !== page.title ? `${page.title} › ${headerTitle}` : page.title;
    visit({ path: pathname, title, icon: page.icon });
  }, [pathname, headerTitle, visit]);

  const sections = useMemo<MenuSections>(
    () => [
      recent
        .filter((place) => place.path !== pathname)
        .map((place) => ({ id: place.path, label: place.title, icon: place.icon, onSelect: () => navigate(place.path) })),
    ],
    [recent, pathname, navigate],
  );

  return {
    canGoBack: index > 0,
    canGoForward: index < maxIndex,
    back: () => navigate(-1),
    forward: () => navigate(1),
    sections,
    hasRecent: sections[0]!.length > 0,
  };
}
