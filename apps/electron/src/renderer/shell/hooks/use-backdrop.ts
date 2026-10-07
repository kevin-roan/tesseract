import { useEffect } from "react";
import { useWindowState } from "./use-window-state";

const BACKDROP_ATTRIBUTE = "data-backdrop";

export function useBackdrop(): boolean {
  const { focused } = useWindowState();
  useEffect(() => {
    const root = document.documentElement;
    if (focused) root.removeAttribute(BACKDROP_ATTRIBUTE);
    else root.setAttribute(BACKDROP_ATTRIBUTE, "");
    return () => root.removeAttribute(BACKDROP_ATTRIBUTE);
  }, [focused]);
  return !focused;
}
