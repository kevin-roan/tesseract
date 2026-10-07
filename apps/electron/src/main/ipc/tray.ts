import { IpcError } from "../../shared/ipc-types";
import { IPC_LABELS } from "../labels";
import { setTrayStatus, trayState } from "../services/tray";
import { defineService } from "./_framework/define";

export default defineService("tray", {
  state: () => trayState(),
  setStatus: (_context, label) => {
    if (typeof label !== "string") throw new IpcError("invalid_argument", IPC_LABELS.invalidTrayStatus);
    return setTrayStatus(label);
  },
});
