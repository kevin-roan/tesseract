import { useEffect, type RefObject } from "react";

export function useActiveIntoView(listRef: RefObject<HTMLElement | null>, active: number, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || active < 0) return;
    const element = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (element && typeof element.scrollIntoView === "function") element.scrollIntoView({ block: "nearest" });
  }, [active, enabled, listRef]);
}
