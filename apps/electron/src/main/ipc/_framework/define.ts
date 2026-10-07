import type { BrowserWindow, WebContents } from "electron";
import type { EventName, EventPayload, MethodArgs, MethodName, MethodResult, ServiceName } from "../../../shared/ipc";
import { NotImplementedError } from "../../../shared/ipc-types";

export interface HandlerContext {
  sender: WebContents;
  window: BrowserWindow | null;
}

export type ServiceHandlers<S extends ServiceName> = {
  [M in MethodName<S>]: (
    context: HandlerContext,
    ...args: MethodArgs<S, M>
  ) => MethodResult<S, M> | Promise<MethodResult<S, M>>;
};

export interface ServiceEmitter<S extends ServiceName> {
  emit<E extends EventName<S>>(event: E, payload: EventPayload<S, E>): void;
}

export type ServiceStop = () => void | Promise<void>;

export interface ServiceLifecycle<S extends ServiceName> {
  start?(emitter: ServiceEmitter<S>): void | ServiceStop | Promise<void | ServiceStop>;
}

export interface ServiceModule<S extends ServiceName = ServiceName> {
  service: S;
  handlers: ServiceHandlers<S>;
  lifecycle: ServiceLifecycle<S>;
}

export function defineService<S extends ServiceName>(
  service: S,
  handlers: ServiceHandlers<S>,
  lifecycle: ServiceLifecycle<S> = {},
): ServiceModule<S> {
  return { service, handlers, lifecycle };
}

export function notImplemented(service: ServiceName, method: string): never {
  throw new NotImplementedError(`${service}.${method}`);
}
