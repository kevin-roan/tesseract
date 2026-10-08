import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
import { BRIDGE_KEY, parseChannel, type TesseractBridge } from "../shared/ipc";
import type { IpcResult } from "../shared/ipc-types";

function assertChannel(channel: string, event: boolean): void {
  const parsed = parseChannel(channel);
  if (!parsed || parsed.event !== event) throw new Error(`Unknown IPC channel: ${channel}`);
}

type Listener = (payload: unknown) => void;

const channels = new Map<string, Set<Listener>>();

function listenersFor(channel: string): Set<Listener> {
  const existing = channels.get(channel);
  if (existing) return existing;
  const listeners = new Set<Listener>();
  channels.set(channel, listeners);
  ipcRenderer.on(channel, (_event: IpcRendererEvent, payload: unknown) => {
    for (const listener of [...listeners]) listener(payload);
  });
  return listeners;
}

function listen(channel: string, listener: Listener): () => void {
  const listeners = listenersFor(channel);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const bridge: TesseractBridge = {
  invoke(channel, args) {
    assertChannel(channel, false);
    return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<unknown>>;
  },
  on(channel, listener) {
    assertChannel(channel, true);
    return listen(channel, listener);
  },
  getPathForFile(file) {
    return webUtils.getPathForFile(file);
  },
  runtimeArgv: [...process.argv],
};

contextBridge.exposeInMainWorld(BRIDGE_KEY, bridge);
