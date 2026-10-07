import { BrowserWindow } from "electron";
import { eventChannel, type EventName, type EventPayload, type ServiceName } from "../../../shared/ipc";
import type { ServiceEmitter } from "./define";

type LocalListener = (payload: unknown) => void;

const localListeners = new Map<string, Set<LocalListener>>();

export function onServiceEvent<S extends ServiceName, E extends EventName<S>>(
  service: S,
  event: E,
  listener: (payload: EventPayload<S, E>) => void,
): () => void {
  const channel = eventChannel(service, event);
  const set = localListeners.get(channel) ?? new Set<LocalListener>();
  set.add(listener as LocalListener);
  localListeners.set(channel, set);
  return () => {
    set.delete(listener as LocalListener);
  };
}

export function broadcast<S extends ServiceName, E extends EventName<S>>(
  service: S,
  event: E,
  payload: EventPayload<S, E>,
): void {
  const channel = eventChannel(service, event);
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(channel, payload);
  }
  localListeners.get(channel)?.forEach((listener) => listener(payload));
}

export function serviceEmitter<S extends ServiceName>(service: S): ServiceEmitter<S> {
  return { emit: (event, payload) => broadcast(service, event, payload) };
}
