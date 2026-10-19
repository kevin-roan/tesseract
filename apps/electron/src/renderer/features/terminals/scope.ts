import type { TesseractClient } from "@tesseract/client";
import type { TerminalInfo } from "@tesseract/protocol";
import { createContext, useContext } from "react";
import { useIsOnline, useServerEvent } from "../../app/connection";
import { useApiClient } from "../../app/data";
import { terminalSessions, type TerminalSessions } from "./sessions";
import { useTerminalsUi, type TerminalsUiStore } from "./store";

export interface TerminalsScope {
  sessions: TerminalSessions;
  ui: TerminalsUiStore;
  useClient(): TesseractClient | null;
  useOnline(): boolean;
  useTerminalUpdates(onInfo: (info: TerminalInfo) => void): void;
}

function useSandboxTerminalUpdates(onInfo: (info: TerminalInfo) => void): void {
  useServerEvent("terminal.updated", (event) => onInfo(event.terminal));
}

export const SANDBOX_TERMINALS: TerminalsScope = {
  sessions: terminalSessions,
  ui: useTerminalsUi,
  useClient: useApiClient,
  useOnline: useIsOnline,
  useTerminalUpdates: useSandboxTerminalUpdates,
};

export const TerminalsScopeContext = createContext<TerminalsScope>(SANDBOX_TERMINALS);

export function useTerminalsScope(): TerminalsScope {
  return useContext(TerminalsScopeContext);
}
