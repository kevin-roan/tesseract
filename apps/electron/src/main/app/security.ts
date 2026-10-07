import { app, session, shell, type WebContents } from "electron";
import { ENV } from "../../shared/runtime";
import { ALLOWED_PERMISSIONS, EXTERNAL_PROTOCOLS } from "../constants";
import { rendererEntryUrl } from "../windows/entry";

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isInternalUrl(url: string, devUrl: string | undefined, entryUrl: string = rendererEntryUrl()): boolean {
  const parsed = parse(url);
  if (!parsed) return false;
  if (devUrl) {
    const dev = parse(devUrl);
    return dev !== null && dev.protocol !== "file:" && parsed.origin === dev.origin;
  }
  const entry = parse(entryUrl);
  return entry !== null && parsed.protocol === "file:" && parsed.host === entry.host && parsed.pathname === entry.pathname;
}

export function externalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return EXTERNAL_PROTOCOLS.includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function openOutside(url: string): void {
  const target = externalUrl(url);
  if (target) void shell.openExternal(target);
}

function harden(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (isInternalUrl(url, process.env[ENV.rendererUrl])) return;
    event.preventDefault();
    openOutside(url);
  });
  contents.on("will-attach-webview", (event) => event.preventDefault());
}

export function installSecurity(): void {
  app.on("web-contents-created", (_event, contents) => harden(contents));
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.includes(permission));
  });
}
