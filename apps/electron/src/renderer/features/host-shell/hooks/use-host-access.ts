import type { TesseractClient } from "@tesseract/client";
import { useEffect, useState } from "react";
import type { HostShellState } from "../../../../shared/contracts/hostShell";
import { createHostClient } from "../client";
import { hostAccess, sessionRefreshDelay } from "../model";
import type { HostAccess } from "../types";
import { useHostShellState, type HostShellStateOptions } from "./use-host-shell-state";

export interface HostAccessState {
  state: HostShellState | null;
  access: HostAccess;
  client: TesseractClient | null;
}

function useSessionClock(state: HostShellState | null): number {
  const [now, setNow] = useState(() => Date.now());
  const expiresAt = state?.sessionExpiresAt ?? null;
  useEffect(() => {
    setNow(Date.now());
    const delay = sessionRefreshDelay(expiresAt, Date.now());
    if (delay === null) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), delay + 1);
    return () => clearTimeout(timer);
  }, [expiresAt]);
  return now;
}

export function useHostAccess(options: HostShellStateOptions = {}): HostAccessState {
  const state = useHostShellState(options);
  const now = useSessionClock(state);
  const access = hostAccess(state, now);
  const url = access === "ready" ? (state?.pairing?.url ?? null) : null;
  return { state, access, client: url ? createHostClient(url) : null };
}

export function useHostClient(): TesseractClient | null {
  return useHostAccess().client;
}
