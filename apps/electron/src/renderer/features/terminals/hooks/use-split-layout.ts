import { useEffect, useRef } from "react";
import { isCollapsed, sidebarWidth } from "../model";
import { useTerminalsUi } from "../store";
import { useElementSize } from "./use-element-size";

export function useSplitLayout() {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const width = size && size.width > 0 ? size.width : null;
  const collapsed = isCollapsed(width);
  const drawerOpen = useTerminalsUi((state) => state.drawerOpen);
  const setDrawerOpen = useTerminalsUi((state) => state.setDrawerOpen);

  const previous = useRef(collapsed);
  useEffect(() => {
    if (previous.current === collapsed) return;
    previous.current = collapsed;
    if (!collapsed) setDrawerOpen(false);
  }, [collapsed, setDrawerOpen]);

  return {
    ref,
    measured: size !== null,
    collapsed,
    sidebarWidth: sidebarWidth(width),
    drawerOpen: collapsed && drawerOpen,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
  };
}
