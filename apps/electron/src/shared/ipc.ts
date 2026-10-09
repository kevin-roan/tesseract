import type { AndroidContract } from "./contracts/android";
import type { AppContract } from "./contracts/app";
import type { AttachmentsContract } from "./contracts/attachments";
import type { ClaudeContract } from "./contracts/claude";
import type { ConnectionContract } from "./contracts/connection";
import type { ContainersContract } from "./contracts/containers";
import type { DockerContract } from "./contracts/docker";
import type { FilesContract } from "./contracts/files";
import type { HostShellContract } from "./contracts/hostShell";
import type { HttpContract } from "./contracts/http";
import type { MetricsContract } from "./contracts/metrics";
import type { OnboardingContract } from "./contracts/onboarding";
import type { SandboxContract } from "./contracts/sandbox";
import type { SttContract } from "./contracts/stt";
import type { SyncBackContract } from "./contracts/syncback";
import type { TrayContract } from "./contracts/tray";
import type { UpdatesContract } from "./contracts/updates";
import type { WindowContract } from "./contracts/window";
import type { Unsubscribe } from "./contracts/common";
import type { IpcResult } from "./ipc-types";

export type IpcContract = {
  app: AppContract;
  window: WindowContract;
  tray: TrayContract;
  updates: UpdatesContract;
  http: HttpContract;
  connection: ConnectionContract;
  docker: DockerContract;
  sandbox: SandboxContract;
  containers: ContainersContract;
  android: AndroidContract;
  onboarding: OnboardingContract;
  syncback: SyncBackContract;
  attachments: AttachmentsContract;
  files: FilesContract;
  hostShell: HostShellContract;
  claude: ClaudeContract;
  stt: SttContract;
  metrics: MetricsContract;
};

export const SERVICE_NAMES = [
  "app",
  "window",
  "tray",
  "updates",
  "http",
  "connection",
  "docker",
  "sandbox",
  "containers",
  "android",
  "onboarding",
  "syncback",
  "attachments",
  "files",
  "hostShell",
  "claude",
  "stt",
  "metrics",
] as const satisfies readonly (keyof IpcContract)[];

export type ServiceName = (typeof SERVICE_NAMES)[number];

type AssertAllServicesListed = Exclude<keyof IpcContract, ServiceName> extends never ? true : never;
export const ALL_SERVICES_LISTED: AssertAllServicesListed = true;

export type Methods<S extends ServiceName> = IpcContract[S]["methods"];
export type Events<S extends ServiceName> = IpcContract[S]["events"];
export type MethodName<S extends ServiceName> = Extract<keyof Methods<S>, string>;
export type EventName<S extends ServiceName> = Extract<keyof Events<S>, string>;

type Fn<T> = T extends (...args: infer A) => infer R ? { args: A; result: R } : never;

export type MethodArgs<S extends ServiceName, M extends MethodName<S>> = Fn<Methods<S>[M]>["args"];
export type MethodResult<S extends ServiceName, M extends MethodName<S>> = Awaited<Fn<Methods<S>[M]>["result"]>;
export type EventPayload<S extends ServiceName, E extends EventName<S>> = Events<S>[E];

export const IPC_PREFIX = "tesseract";

export function invokeChannel(service: string, method: string): string {
  return `${IPC_PREFIX}:${service}:${method}`;
}

export function eventChannel(service: string, event: string): string {
  return `${IPC_PREFIX}:${service}:event:${event}`;
}

export function parseChannel(channel: string): { service: ServiceName; name: string; event: boolean } | null {
  const parts = channel.split(":");
  if (parts[0] !== IPC_PREFIX) return null;
  const service = parts[1];
  if (!service || !isServiceName(service)) return null;
  if (parts.length === 3 && parts[2]) return { service, name: parts[2], event: false };
  if (parts.length === 4 && parts[2] === "event" && parts[3]) return { service, name: parts[3], event: true };
  return null;
}

export function isServiceName(value: string): value is ServiceName {
  return (SERVICE_NAMES as readonly string[]).includes(value);
}

export type ServiceClient<S extends ServiceName> = {
  [M in MethodName<S>]: (...args: MethodArgs<S, M>) => Promise<MethodResult<S, M>>;
} & {
  on<E extends EventName<S>>(event: E, listener: (payload: EventPayload<S, E>) => void): Unsubscribe;
};

export type IpcClient = { [S in ServiceName]: ServiceClient<S> };

export interface TesseractBridge {
  invoke(channel: string, args: unknown[]): Promise<IpcResult<unknown>>;
  on(channel: string, listener: (payload: unknown) => void): Unsubscribe;
  getPathForFile(file: File): string;
  runtimeArgv: readonly string[];
}

export const BRIDGE_KEY = "tesseract";
