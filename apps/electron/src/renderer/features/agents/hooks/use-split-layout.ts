import { useEffect, useRef } from "react";
import { BREAKPOINTS, LIST_WIDTH } from "../constants";
import { listWidth } from "../model";
import { useAgentsUi } from "../store";
import { useElementWidth } from "./use-element-width";

export function useSplitLayout() {
  const [ref, pageWidth] = useElementWidth<HTMLDivElement>();
  const sidebarOpen = useAgentsUi((state) => state.sidebarOpen);
  const setSidebarOpen = useAgentsUi((state) => state.setSidebarOpen);
  const measured = !!pageWidth;
  const collapsed = measured && pageWidth <= BREAKPOINTS.collapsed;
  const compact = measured && pageWidth <= BREAKPOINTS.compact;
  const width = listWidth(pageWidth ?? 0, LIST_WIDTH);

  const previousCollapsed = useRef<boolean | null>(null);
  useEffect(() => {
    if (!measured || previousCollapsed.current === collapsed) return;
    const first = previousCollapsed.current === null;
    previousCollapsed.current = collapsed;
    if (first && (!collapsed || useAgentsUi.getState().revealToken > 0)) return;
    setSidebarOpen(!collapsed);
  }, [measured, collapsed, setSidebarOpen]);

  const view = useAgentsUi((state) => state.view);
  const selectedRunId = useAgentsUi((state) => state.selectedRunId);
  const focusToken = useAgentsUi((state) => state.focusToken);
  const selectToken = useAgentsUi((state) => state.selectToken);
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const detailMounted = useRef(false);
  useEffect(() => {
    if (!detailMounted.current) {
      detailMounted.current = true;
      return;
    }
    if (collapsedRef.current) setSidebarOpen(false);
  }, [view, selectedRunId, focusToken, selectToken, setSidebarOpen]);

  const previousOpen = useRef(sidebarOpen);
  const toggled = previousOpen.current !== sidebarOpen;
  useEffect(() => {
    previousOpen.current = sidebarOpen;
  }, [sidebarOpen]);

  return {
    ref,
    measured,
    collapsed,
    compact,
    width,
    sidebarOpen,
    animateToggle: toggled,
  };
}
