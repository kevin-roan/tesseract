import { existsSync } from "node:fs";
import { Notification } from "electron";
import type { AppNotification } from "../../shared/contracts/app";
import { WINDOW_ICON } from "../constants";
import { mainContext, platform } from "../context";
import { dispatchCommand, showApp } from "./commands";
import { bundledResource } from "./resources";

const active = new Set<Notification>();
const byId = new Map<string, Notification>();

function icon(): string | undefined {
  if (platform() === "darwin") return undefined;
  const file = bundledResource(...WINDOW_ICON);
  return existsSync(file) ? file : undefined;
}

function release(native: Notification, id: string | undefined): void {
  active.delete(native);
  if (id && byId.get(id) === native) byId.delete(id);
}

export function showNotification(notification: AppNotification, onClick?: () => void): boolean {
  if (mainContext().isTest || !Notification.isSupported()) return false;
  const { id, command } = notification;
  if (id) byId.get(id)?.close();
  const native = new Notification({ title: notification.title, body: notification.body ?? "", icon: icon() });
  native.on("click", () => {
    release(native, id);
    if (onClick) onClick();
    else if (command) void dispatchCommand(command);
    else void showApp();
  });
  native.on("close", () => release(native, id));
  native.on("failed", () => release(native, id));
  active.add(native);
  if (id) byId.set(id, native);
  native.show();
  return true;
}

export function closeNotifications(): void {
  for (const native of active) native.close();
  active.clear();
  byId.clear();
}
