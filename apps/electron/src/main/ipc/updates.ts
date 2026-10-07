import { defineService } from "./_framework/define";
import { checkForUpdates, downloadUpdate, installUpdate, updateState } from "../services/updater";

export default defineService("updates", {
  state: () => updateState(),
  check: () => checkForUpdates(),
  download: () => downloadUpdate(),
  install: () => installUpdate(),
});
