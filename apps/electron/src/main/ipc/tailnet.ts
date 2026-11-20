import { HOST_TAILNET_MODES, type HostTailnetMode } from "../../shared/contracts/tailnet";
import { IpcError } from "../../shared/ipc-types";
import { mainContext } from "../context";
import { onAccountChanged } from "../services/account";
import {
  hostTailnetState,
  initHostTailnet,
  resetHostTailnet,
  restartHostTailnet,
  setHostTailnetMode,
  stopHostTailnet,
  syncHostTailnet,
} from "../services/host-tailnet";
import { onSettingsChanged } from "../services/settings";
import { defineService } from "./_framework/define";

function requireMode(mode: unknown): HostTailnetMode {
  if (!HOST_TAILNET_MODES.includes(mode as HostTailnetMode)) throw new IpcError("invalid_argument", `Unknown mode ${String(mode)}`);
  return mode as HostTailnetMode;
}

export default defineService(
  "tailnet",
  {
    state: () => hostTailnetState(),
    setMode: (_context, mode) => setHostTailnetMode(requireMode(mode)),
    restart: () => restartHostTailnet(),
  },
  {
    start: () => {
      if (mainContext().fixtures) return;
      const stopAccount = onAccountChanged((next, previous) => {
        const sameAccount = next.account?.id === previous.account?.id && next.serverUrl === previous.serverUrl;
        if (sameAccount) return;
        // Signed out, deleted, or another account/server: the node's identity belongs to the old one.
        if (previous.account) void resetHostTailnet().then(() => syncHostTailnet());
        else void syncHostTailnet();
      });
      const stopSettings = onSettingsChanged((next, previous) => {
        if (next.hostTailnet !== previous.hostTailnet) void syncHostTailnet();
      });
      void initHostTailnet();
      return async () => {
        stopAccount();
        stopSettings();
        await stopHostTailnet();
      };
    },
  },
);
