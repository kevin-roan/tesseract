import { SANDBOX_TERMINALS, type TerminalsScope } from "./scope";
import { createTerminalSessions } from "./sessions";
import { createTerminalsUiStore } from "./store";

export const useProjectTerminalsUi = createTerminalsUiStore();
export const projectTerminalSessions = createTerminalSessions(useProjectTerminalsUi);

export const PROJECT_TERMINALS: TerminalsScope = {
  ...SANDBOX_TERMINALS,
  sessions: projectTerminalSessions,
  ui: useProjectTerminalsUi,
};
