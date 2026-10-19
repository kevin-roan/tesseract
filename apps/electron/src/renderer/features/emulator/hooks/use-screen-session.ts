import type { TesseractClient } from "@tesseract/client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { INITIAL_SCREEN } from "../constants";
import { ScreenSession, type ScreenSessionDeps } from "../screen/session";
import { screenSocketOpener } from "../screen/socket";
import type { ScreenSpec } from "../types";

export function useScreenSession(spec: ScreenSpec, client: TesseractClient | null, device: string | null, live: boolean) {
  const opener = useRef<ScreenSessionDeps["openSocket"] | null>(null);
  opener.current = client ? screenSocketOpener(client) : null;
  const [session] = useState(
    () =>
      new ScreenSession(spec, {
        openSocket: (path, query) => {
          const open = opener.current;
          return open ? open(path, query) : Promise.reject(new Error("Not connected"));
        },
      }),
  );

  const active = live && client !== null;
  useEffect(() => {
    if (active) void session.connect({ device });
    else session.disconnect();
  }, [session, active, device, client]);

  useEffect(() => () => session.dispose(), [session]);

  const state = useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.state,
    () => INITIAL_SCREEN,
  );

  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => session.attach(canvas), [session]);
  const reconnect = useCallback(() => void session.connect({ device }), [session, device]);

  return { session, state, canvasRef, reconnect };
}

export type ScreenSessionHandle = ReturnType<typeof useScreenSession>;
