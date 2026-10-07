import { BrowserWindow, ipcMain } from "electron";
import { SERVICE_NAMES, invokeChannel, type ServiceName } from "../../../shared/ipc";
import { IpcError, toIpcErrorPayload, type IpcResult } from "../../../shared/ipc-types";
import type { HandlerContext, ServiceModule, ServiceStop } from "./define";
import { serviceEmitter } from "./events";
import { isTrustedSender } from "./trust";
import { createLogger } from "../../../core/log";

const log = createLogger("ipc");

type AnyHandler = (context: HandlerContext, ...args: unknown[]) => unknown;

const discovered = import.meta.glob<{ default: ServiceModule }>("../*.ts", { eager: true });

export function serviceModules(): ServiceModule[] {
  return Object.values(discovered).map((module) => module.default);
}

export function missingServices(): ServiceName[] {
  const present = new Set(serviceModules().map((module) => module.service));
  return SERVICE_NAMES.filter((name) => !present.has(name));
}

async function run(handler: AnyHandler, context: HandlerContext, args: unknown[]): Promise<IpcResult<unknown>> {
  try {
    return { ok: true, value: await handler(context, ...args) };
  } catch (error) {
    return { ok: false, error: toIpcErrorPayload(error) };
  }
}

export async function registerIpc(): Promise<() => Promise<void>> {
  const stops: ServiceStop[] = [];
  const channels: string[] = [];
  for (const module of serviceModules()) {
    for (const [method, handler] of Object.entries(module.handlers as Record<string, AnyHandler>)) {
      const channel = invokeChannel(module.service, method);
      channels.push(channel);
      ipcMain.handle(channel, (event, ...args: unknown[]) => {
        if (!isTrustedSender(event)) {
          return { ok: false, error: new IpcError("forbidden", "Untrusted IPC sender").toPayload() };
        }
        const context: HandlerContext = { sender: event.sender, window: BrowserWindow.fromWebContents(event.sender) };
        return run(handler, context, args);
      });
    }
  }
  for (const module of serviceModules()) {
    try {
      const stop = await module.lifecycle.start?.(serviceEmitter(module.service) as never);
      if (stop) stops.push(stop);
    } catch (error) {
      log.error(`service ${module.service} failed to start: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return async () => {
    for (const channel of channels) ipcMain.removeHandler(channel);
    for (const stop of stops.reverse()) await Promise.resolve(stop()).catch(() => undefined);
  };
}
