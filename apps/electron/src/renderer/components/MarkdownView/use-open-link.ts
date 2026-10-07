import { useCallback } from "react";
import { ipc } from "../../lib/ipc";
import { safeUrl } from "./parser";

export function useOpenLink() {
  return useCallback((url: string) => {
    const target = safeUrl(url);
    if (!target) return;
    ipc.app.openExternal(target).catch(() => {
      globalThis.open?.(target, "_blank", "noopener,noreferrer");
    });
  }, []);
}
