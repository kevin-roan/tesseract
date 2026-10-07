import type { TheOneClient } from "@theone/client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { INITIAL_SESSION } from "../model";
import type { SessionState } from "../types";
import { sessionDepsFor } from "../vnc/deps";
import { VncSession, type SessionDeps } from "../vnc/session";

export interface VncSessionHandle {
  session: VncSession;
  state: SessionState;
  host: HTMLDivElement;
}

function createHost(): HTMLDivElement {
  const host = document.createElement("div");
  host.dataset.vncHost = "";
  return host;
}

export function useVncSession(
  client: TheOneClient | null,
  running: boolean,
  depsFor: (client: TheOneClient | null) => SessionDeps | null = sessionDepsFor,
): VncSessionHandle {
  const [host] = useState(createHost);
  const [session] = useState(() => new VncSession(null));
  const deps = useMemo(() => depsFor(client), [client, depsFor]);
  const runningRef = useRef(running);
  runningRef.current = running;

  useEffect(() => {
    session.attach(host);
  }, [host, session]);

  useEffect(() => {
    session.setDeps(deps);
    if (deps && runningRef.current) session.reconnect();
  }, [deps, session]);

  useEffect(() => {
    if (running) session.start();
    else session.stop();
  }, [running, session]);

  useEffect(() => () => session.dispose(), [session]);

  const state = useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.state,
    () => INITIAL_SESSION,
  );

  return useMemo(() => ({ session, state, host }), [session, state, host]);
}
