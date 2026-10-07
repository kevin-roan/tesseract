import { useCallback, useEffect, useRef, useState } from "react";
import { ipc } from "../../../lib/ipc";
import { FULLSCREEN_REVEAL_EDGE_PX, FULLSCREEN_REVEAL_MS } from "../constants";

export interface FullscreenStage {
  fullscreen: boolean;
  revealed: boolean;
  enter(): void;
  exit(): void;
  toggle(): void;
  onPointerMove(clientY: number): void;
}

export interface FullscreenOptions {
  allowed: boolean;
  windowFullscreen: boolean;
  onEnter?(): void;
}

function setWindowFullscreen(on: boolean): void {
  ipc.window.setFullscreen(on).catch(() => undefined);
}

export function useFullscreenStage({ allowed, windowFullscreen, onEnter }: FullscreenOptions): FullscreenStage {
  const [fullscreen, setFullscreen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sawWindowFullscreen = useRef(false);
  const ownsWindowFullscreen = useRef(false);
  const state = useRef({ fullscreen, allowed, windowFullscreen });
  state.current = { fullscreen, allowed, windowFullscreen };
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  const reveal = useCallback(() => {
    setRevealed(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setRevealed(false), FULLSCREEN_REVEAL_MS);
  }, []);

  const exit = useCallback(() => {
    if (!state.current.fullscreen) return;
    sawWindowFullscreen.current = false;
    setFullscreen(false);
    setRevealed(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (ownsWindowFullscreen.current) setWindowFullscreen(false);
    ownsWindowFullscreen.current = false;
  }, []);

  const enter = useCallback(() => {
    if (state.current.fullscreen || !state.current.allowed) return;
    setFullscreen(true);
    ownsWindowFullscreen.current = !state.current.windowFullscreen;
    if (ownsWindowFullscreen.current) setWindowFullscreen(true);
    reveal();
    onEnterRef.current?.();
  }, [reveal]);

  const toggle = useCallback(() => (state.current.fullscreen ? exit() : enter()), [enter, exit]);

  const onPointerMove = useCallback(
    (clientY: number) => {
      if (state.current.fullscreen && clientY <= FULLSCREEN_REVEAL_EDGE_PX) reveal();
    },
    [reveal],
  );

  useEffect(() => {
    if (!allowed) exit();
  }, [allowed, exit]);

  useEffect(() => {
    if (!fullscreen) return;
    if (windowFullscreen) sawWindowFullscreen.current = true;
    else if (sawWindowFullscreen.current) exit();
  }, [fullscreen, windowFullscreen, exit]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (state.current.fullscreen && ownsWindowFullscreen.current) setWindowFullscreen(false);
    },
    [],
  );

  return { fullscreen, revealed, enter, exit, toggle, onPointerMove };
}
