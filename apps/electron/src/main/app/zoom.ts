import type { BrowserWindow } from "electron";
import { stepZoom } from "../../core/config";
import type { ZoomDirection } from "../../shared/contracts/window";
import { eventChannel } from "../../shared/ipc";
import { windowState } from "../ipc/window";
import { updateSettings } from "../services/settings";

export async function zoomWindow(window: BrowserWindow, direction: ZoomDirection): Promise<number> {
  const zoom = stepZoom(window.webContents.getZoomFactor(), direction);
  window.webContents.setZoomFactor(zoom);
  await updateSettings({ zoom });
  if (!window.isDestroyed()) window.webContents.send(eventChannel("window", "state"), windowState(window));
  return zoom;
}
