import { useEffect, useRef } from "react";
import { isCollapsed, sidebarWidth } from "../model";
import { useTerminalsScope } from "../scope";
import { useElementSize } from "./use-element-size";

export function useSplitLayout() {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const width = size && size.width > 0 ? size.width : null;
  const collapsed = isCollapsed(width);
  const { ui } = useTerminalsScope();
  const drawerOpen = ui((state) => state.drawerOpen);
  const setDrawerOpen = ui((state) => state.setDrawerOpen);

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
