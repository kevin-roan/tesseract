import { useCallback, useEffect, useRef, type ClipboardEvent, type KeyboardEvent, type PointerEvent } from "react";
import { useAccelGuardWhileFocused } from "../../../components/AccelGuard";
import type { ScreenSession } from "../screen/session";

export function useScreenInput(session: ScreenSession) {
  const stageRef = useRef<HTMLDivElement>(null);
  useAccelGuardWhileFocused(stageRef);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      session.wheel(event);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [session]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      stageRef.current?.focus();
      if (!session.pointerDown(event)) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        return;
      }
    },
    [session],
  );
  const onPointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => session.pointerMove(event), [session]);
  const onPointerUp = useCallback((event: PointerEvent<HTMLCanvasElement>) => session.pointerUp(event), [session]);
  const onPointerCancel = useCallback((event: PointerEvent<HTMLCanvasElement>) => session.pointerUp(event, true), [session]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (session.key(event)) event.preventDefault();
    },
    [session],
  );

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      const text = event.clipboardData.getData("text/plain");
      if (!text) return;
      event.preventDefault();
      session.text(text);
    },
    [session],
  );

  return {
    stageRef,
    stage: { onKeyDown, onPaste },
    canvas: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu: (event: { preventDefault(): void }) => event.preventDefault() },
  };
}
