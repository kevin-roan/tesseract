import type { HostSessionState } from "../types";

/** On the web the session stays in memory only: browser storage is readable by any script on the page. */
export const hostSessionStorage = {
  read: async (_sandboxId: string): Promise<HostSessionState | null> => null,
  write: async (_sandboxId: string, _session: HostSessionState): Promise<void> => {},
  remove: async (_sandboxId: string): Promise<void> => {},
};
