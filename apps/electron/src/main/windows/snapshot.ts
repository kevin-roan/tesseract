import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { BrowserWindow } from "electron";
import type { SnapshotRequest } from "../../shared/runtime";
import { createLogger } from "../../core/log";
import { baseWindowOptions, loadRoute, trackSnapshotWindow } from "./manager";

const log = createLogger("snapshot");
const IDLE_SCRIPT = "window.__tesseractIdle ? window.__tesseractIdle() : Promise.resolve(false)";

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

export async function captureSnapshot(request: SnapshotRequest): Promise<void> {
  const window = trackSnapshotWindow(
    new BrowserWindow({
      ...baseWindowOptions("snapshot"),
      width: request.width,
      height: request.height,
      useContentSize: true,
      resizable: false,
      enableLargerThanScreen: true,
    }),
  );
  window.webContents.setZoomFactor(1);
  await loadRoute(window, request.route);
  const idle = await withTimeout(
    window.webContents.executeJavaScript(IDLE_SCRIPT, true) as Promise<boolean>,
    request.timeoutMs,
    false,
  );
  if (!idle) log.warn(`renderer did not report idle within ${request.timeoutMs}ms; capturing anyway`);
  const image = await window.webContents.capturePage();
  await mkdir(dirname(request.out), { recursive: true });
  await writeFile(request.out, image.toPNG());
  const size = image.getSize();
  log.info(`wrote ${request.out} (${size.width}x${size.height})`);
  window.destroy();
}
