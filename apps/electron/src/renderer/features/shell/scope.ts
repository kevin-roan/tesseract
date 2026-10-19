import { useHostAccess, useHostClient } from "../host-shell/hooks/use-host-access";
import type { TerminalsScope } from "../terminals/scope";
import { createTerminalSessions } from "../terminals/sessions";
import { createTerminalsUiStore } from "../terminals/store";

export const useHostTerminalsUi = createTerminalsUiStore();
export const hostTerminalSessions = createTerminalSessions(useHostTerminalsUi);

const useHostOnline = () => useHostAccess().access === "ready";
const noUpdates = () => undefined;

export const HOST_TERMINALS: TerminalsScope = {
  sessions: hostTerminalSessions,
  ui: useHostTerminalsUi,
  useClient: useHostClient,
  useOnline: useHostOnline,
  useTerminalUpdates: noUpdates,
};
