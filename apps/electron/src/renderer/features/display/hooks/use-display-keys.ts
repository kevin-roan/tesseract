import { useEffect } from "react";
import { ESCAPE_KEY, FULLSCREEN_KEY } from "../constants";

export interface DisplayKeysOptions {
  root: HTMLElement | null;
  fullscreen: boolean;
  canvasTakesEscape: () => boolean;
  onToggleFullscreen(): void;
  onExitFullscreen(): void;
}

export function useDisplayKeys({ root, fullscreen, canvasTakesEscape, onToggleFullscreen, onExitFullscreen }: DisplayKeysOptions): void {
  useEffect(() => {
    if (!root) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== FULLSCREEN_KEY) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) onToggleFullscreen();
    };
    root.addEventListener("keydown", onKeyDown, true);
    return () => root.removeEventListener("keydown", onKeyDown, true);
  }, [root, onToggleFullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === FULLSCREEN_KEY) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) onExitFullscreen();
        return;
      }
      if (event.key === ESCAPE_KEY && !canvasTakesEscape()) {
        event.preventDefault();
        onExitFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [fullscreen, canvasTakesEscape, onExitFullscreen]);
}
