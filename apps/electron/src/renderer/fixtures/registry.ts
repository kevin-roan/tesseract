import type { ServiceName } from "../../shared/ipc";
import type { HttpFixtureRoute, IpcFixtureMethods, SocketFixtureRoute } from "./types";

const BASE_AREA = "base";

type Modules<T> = Record<string, { default: T }>;

const ipcModules = import.meta.glob<{ default: IpcFixtureMethods }>("./*/ipc.ts", { eager: true });
const httpModules = import.meta.glob<{ default: HttpFixtureRoute[] }>("./*/http.ts", { eager: true });
const socketModules = import.meta.glob<{ default: SocketFixtureRoute[] }>("./*/socket.ts", { eager: true });

function areaOf(path: string): string {
  return path.split("/")[1] ?? "";
}

function ordered<T>(modules: Modules<T>): T[] {
  return Object.entries(modules)
    .sort(([a], [b]) => Number(areaOf(a) === BASE_AREA) - Number(areaOf(b) === BASE_AREA) || a.localeCompare(b))
    .map(([, module]) => module.default);
}

const ipcFixtures = ordered(ipcModules);
const overrides: IpcFixtureMethods[] = [];

export const httpFixtures: HttpFixtureRoute[] = ordered(httpModules).flat();
export const socketFixtures: SocketFixtureRoute[] = ordered(socketModules).flat();

type AnyFixture = (...args: unknown[]) => unknown;

export function findIpcFixture(service: ServiceName, method: string): AnyFixture | null {
  for (const source of [...overrides, ...ipcFixtures]) {
    const fn = (source[service] as Record<string, AnyFixture> | undefined)?.[method];
    if (fn) return fn;
  }
  return null;
}

export function overrideIpcFixtures(methods: IpcFixtureMethods): () => void {
  overrides.unshift(methods);
  return () => {
    const index = overrides.indexOf(methods);
    if (index !== -1) overrides.splice(index, 1);
  };
}

const listeners = new Map<string, Set<(payload: unknown) => void>>();

export function subscribeIpcFixtureEvents(service: ServiceName, event: string, listener: (payload: unknown) => void) {
  const key = `${service}:${event}`;
  const set = listeners.get(key) ?? new Set();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
  };
}

export function emitFixtureEvent(service: ServiceName, event: string, payload: unknown): void {
  listeners.get(`${service}:${event}`)?.forEach((listener) => listener(payload));
}
