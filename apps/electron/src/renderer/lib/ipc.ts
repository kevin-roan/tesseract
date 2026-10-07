import {
  eventChannel,
  invokeChannel,
  type EventName,
  type EventPayload,
  type IpcClient,
  type MethodArgs,
  type MethodName,
  type MethodResult,
  type ServiceClient,
  type ServiceName,
} from "../../shared/ipc";
import { IpcError, isIpcErrorPayload, type IpcResult } from "../../shared/ipc-types";
import type { Unsubscribe } from "../../shared/contracts/common";
import { bridge, isFixtureMode } from "../app/runtime";
import { findIpcFixture, subscribeIpcFixtureEvents } from "../fixtures/registry";

export async function invoke<S extends ServiceName, M extends MethodName<S>>(
  service: S,
  method: M,
  ...args: MethodArgs<S, M>
): Promise<MethodResult<S, M>> {
  if (isFixtureMode()) {
    const fixture = findIpcFixture(service, method);
    if (fixture) return (await fixture(...(args as unknown[]))) as MethodResult<S, M>;
  }
  const target = bridge();
  if (!target) throw new IpcError("unavailable", `${service}.${method} needs the Electron bridge`);
  const result = (await target.invoke(invokeChannel(service, method), args as unknown[])) as IpcResult<MethodResult<S, M>>;
  if (result.ok) return result.value;
  const error = isIpcErrorPayload(result.error) ? result.error : { code: "internal" as const, message: String(result.error) };
  throw new IpcError(error.code, error.message, error.detail);
}

export function subscribe<S extends ServiceName, E extends EventName<S>>(
  service: S,
  event: E,
  listener: (payload: EventPayload<S, E>) => void,
): Unsubscribe {
  const stops: Unsubscribe[] = [];
  if (isFixtureMode()) stops.push(subscribeIpcFixtureEvents(service, event, listener as (payload: unknown) => void));
  const target = bridge();
  if (target) stops.push(target.on(eventChannel(service, event), listener as (payload: unknown) => void));
  return () => stops.forEach((stop) => stop());
}

function serviceClient<S extends ServiceName>(service: S): ServiceClient<S> {
  return new Proxy({} as ServiceClient<S>, {
    get(_target, property) {
      if (typeof property !== "string") return undefined;
      if (property === "on") {
        return (event: EventName<S>, listener: (payload: unknown) => void) => subscribe(service, event, listener);
      }
      return (...args: unknown[]) => invoke(service, property as MethodName<S>, ...(args as never));
    },
  });
}

const clients = new Map<ServiceName, unknown>();

export const ipc: IpcClient = new Proxy({} as IpcClient, {
  get(_target, property) {
    if (typeof property !== "string") return undefined;
    const name = property as ServiceName;
    if (!clients.has(name)) clients.set(name, serviceClient(name));
    return clients.get(name);
  },
});

export function pathForFile(file: File): string | null {
  return bridge()?.getPathForFile(file) ?? null;
}
