import { isAbsolute } from "node:path";
import { app, shell } from "electron";
import { IpcError } from "../../shared/ipc-types";
import type { RuntimeInfo, WindowKind } from "../../shared/runtime";
import { markQuitting } from "../app/lifecycle";
import { externalUrl } from "../app/security";
import { appPaths, mainContext, platform } from "../context";
import { IPC_LABELS } from "../labels";
import { cliStatus, installCli } from "../services/cli-install";
import { markRendererIdle } from "../services/idle";
import { showNotification } from "../services/notifications";
import { currentSettings, updateSettings } from "../services/settings";
import { getWindow } from "../windows/manager";
import { defineService, type HandlerContext } from "./_framework/define";

function windowKind(context: HandlerContext): WindowKind {
  if (mainContext().args.snapshot) return "snapshot";
  return context.window && context.window === getWindow("onboarding") ? "onboarding" : "main";
}

function validatedUrl(url: unknown): string {
  if (typeof url !== "string") throw new IpcError("invalid_argument", IPC_LABELS.invalidUrl);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new IpcError("invalid_argument", IPC_LABELS.invalidUrl);
  }
  const target = externalUrl(parsed.toString());
  if (!target) throw new IpcError("forbidden", IPC_LABELS.refusedProtocol(parsed.protocol));
  return target;
}

export default defineService("app", {
  runtime: (context): RuntimeInfo => {
    const main = mainContext();
    return {
      platform: platform(),
      arch: process.arch,
      version: app.getVersion(),
      windowKind: windowKind(context),
      fixtures: main.fixtures,
      snapshot: main.args.snapshot !== null,
      appearanceOverride: main.appearanceOverride,
      reducedMotion: main.args.snapshot !== null,
    };
  },
  paths: () => appPaths(),
  settings: () => currentSettings(),
  updateSettings: (_context, patch) => {
    if (typeof patch !== "object" || patch === null) throw new IpcError("invalid_argument", IPC_LABELS.invalidSettings);
    return updateSettings(patch);
  },
  openExternal: async (_context, url) => {
    await shell.openExternal(validatedUrl(url));
  },
  showItemInFolder: (_context, path) => {
    if (typeof path !== "string" || !isAbsolute(path)) throw new IpcError("invalid_argument", IPC_LABELS.invalidPath);
    shell.showItemInFolder(path);
  },
  notify: (_context, notification) => {
    if (typeof notification?.title !== "string") throw new IpcError("invalid_argument", IPC_LABELS.invalidNotification);
    showNotification(notification);
  },
  cliStatus: () => cliStatus(),
  installCli: () => installCli(),
  rendererIdle: (context) => markRendererIdle(context.sender.id),
  quit: () => {
    markQuitting();
    app.quit();
  },
  relaunch: () => {
    markQuitting();
    app.relaunch();
    app.quit();
  },
});
