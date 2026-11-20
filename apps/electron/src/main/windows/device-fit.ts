import { DEVICE_WINDOW_CHROME, type DeviceWindowSize } from "../../shared/device-window";
import { DEVICE_WINDOW_SCREEN_SHARE } from "./config";

export interface DeviceWindowFit {
  size: DeviceWindowSize;
  chrome: DeviceWindowSize;
}

/** The window that shows `screen` at its aspect ratio, at most its native size and a share of the work area. */
export function fitDeviceWindow(screen: DeviceWindowSize, workArea: DeviceWindowSize): DeviceWindowFit {
  const chrome = { width: DEVICE_WINDOW_CHROME.bezel * 2, height: DEVICE_WINDOW_CHROME.bezel * 2 + DEVICE_WINDOW_CHROME.toolbar };
  const room = { width: workArea.width * DEVICE_WINDOW_SCREEN_SHARE - chrome.width, height: workArea.height * DEVICE_WINDOW_SCREEN_SHARE - chrome.height };
  const scale = Math.min(room.width / screen.width, room.height / screen.height, 1);
  return {
    size: { width: Math.round(screen.width * scale) + chrome.width, height: Math.round(screen.height * scale) + chrome.height },
    chrome,
  };
}
