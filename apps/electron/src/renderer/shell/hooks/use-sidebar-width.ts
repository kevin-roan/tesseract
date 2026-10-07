import { useEffect, useState } from "react";
import { useSettings, useUpdateSettings } from "../../app/settings";
import { SIDEBAR_WIDTH } from "../../components/ResizeHandle";
import { useWindowState } from "./use-window-state";

export function useSidebarWidth() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const zoom = useWindowState().zoom || 1;
  const stored = settings.sidebarWidth || SIDEBAR_WIDTH.default;
  const [width, setWidth] = useState(stored);
  useEffect(() => setWidth(stored), [stored]);
  return {
    width,
    zoom,
    onResize: setWidth,
    onCommit: (next: number) => {
      setWidth(next);
      if (next !== stored) update.mutate({ sidebarWidth: next });
    },
  };
}
