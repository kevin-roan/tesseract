import { unwatchFile, watchFile } from "node:fs";
import { hostname } from "node:os";
import { Notification } from "electron";
import { ApiError, NetworkError, TimeoutError, type StreamConnection } from "@theone/client";
import { readConfig } from "../../core/config";
import { createLogger } from "../../core/log";
import { stateDir } from "../../core/paths";
import {
  HttpSyncApi,
  NotConfiguredError,
  SyncBackError,
  SyncBackService,
  SyncState,
  describeError,
  hostChanges,
  listSnapshots,
  previewDiff,
  readLinks,
  toContractDiff,
} from "../../core/syncback";
import { CONFIG_POLL_MS } from "../../core/syncback/constants";
import { IpcError, type IpcErrorCode } from "../../shared/ipc-types";
import { mainContext } from "../context";
import { IPC_LABELS } from "../labels";
import { dispatchCommand } from "../services/commands";
import { isPlainProjectId } from "../services/project-id";
import { storedConnection } from "../services/token-cipher";
import { defineService } from "./_framework/define";
import { serviceEmitter } from "./_framework/events";

const log = createLogger("syncback");
const events = serviceEmitter("syncback");
const notifications = new Map<string, Notification>();
const STATUS_CODES: Record<number, IpcErrorCode> = { 400: "invalid_argument", 401: "forbidden", 403: "forbidden", 404: "not_found", 422: "invalid_argument" };

function environment() {
  return { stateDir: stateDir(mainContext().paths), cwd: process.cwd() };
}

function toIpcError(error: unknown): IpcError {
  if (error instanceof IpcError) return error;
  const message = describeError(error);
  if (error instanceof NotConfiguredError || error instanceof NetworkError) return new IpcError("unavailable", message);
  if (error instanceof TimeoutError) return new IpcError("timeout", message);
  if (error instanceof ApiError) return new IpcError(STATUS_CODES[error.status] ?? "internal", message);
  if (error instanceof SyncBackError) return new IpcError("invalid_argument", message);
  return new IpcError("internal", message);
}

async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toIpcError(error);
  }
}

function projectIdArg(value: unknown): string {
  if (!isPlainProjectId(value)) throw new IpcError("invalid_argument", IPC_LABELS.invalidProjectId);
  return value;
}

function notify(projectId: string, title: string, body: string): void {
  if (!Notification.isSupported()) return;
  notifications.get(projectId)?.close();
  const notification = new Notification({ title, body });
  notification.on("click", () => void dispatchCommand({ type: "navigate", page: "projects", params: { projectId } }));
  notification.on("close", () => {
    if (notifications.get(projectId) === notification) notifications.delete(projectId);
  });
  notifications.set(projectId, notification);
  notification.show();
}

class SyncBackRuntime {
  readonly service: SyncBackService;
  private api: HttpSyncApi | null = null;
  private stream: StreamConnection | null = null;
  private key = "";

  constructor(private readonly configFile: string) {
    this.service = new SyncBackService({
      state: new SyncState(environment().stateDir),
      api: () => this.api,
      host: hostname(),
      notify,
      onChange: (state) => events.emit("state", state),
    });
  }

  currentApi(): HttpSyncApi {
    if (!this.api) throw new NotConfiguredError();
    return this.api;
  }

  async refresh(): Promise<void> {
    const config = storedConnection(await readConfig(this.configFile));
    const key = config ? `${config.apiUrl}\n${config.token}` : "";
    if (key === this.key) return;
    this.key = key;
    this.disconnect();
    if (!config) return;
    try {
      this.api = new HttpSyncApi({ apiUrl: config.apiUrl, token: config.token });
      this.stream = this.api.client.openEvents({
        onEvent: (event) => this.service.handleEvent(event),
        onStateChange: (state) => this.service.setOnline(state === "open"),
        onError: (error) => log.debug(`sync events: ${error.message}`),
      });
    } catch (error) {
      log.warn(`sync-back cannot use the saved connection: ${describeError(error)}`);
      this.api = null;
    }
  }

  private disconnect(): void {
    this.stream?.close();
    this.stream = null;
    this.api = null;
    this.service.setOnline(false);
  }

  stop(): void {
    this.disconnect();
    this.service.stop();
  }
}

let runtime: SyncBackRuntime | null = null;

function requireRuntime(): SyncBackRuntime {
  if (!runtime) throw new IpcError("unavailable", describeError(new NotConfiguredError()));
  return runtime;
}

export default defineService(
  "syncback",
  {
    state: () => runtime?.service.snapshot() ?? { revision: 0, busy: [] },
    submit: (_context, projectId, kind, options) =>
      guarded(() => requireRuntime().service.submit(projectIdArg(projectId), kind, options ?? {})),
    links: () => guarded(() => readLinks(environment())),
    snapshots: (_context, projectId) => guarded(() => listSnapshots(environment(), projectIdArg(projectId))),
    hostChanges: (_context, projectId) =>
      guarded(() => {
        const id = projectIdArg(projectId);
        return runtime ? runtime.service.hostChanges(id) : hostChanges(environment(), id);
      }),
    diff: (_context, projectId, path) =>
      guarded(async () => {
        const id = projectIdArg(projectId);
        const active = requireRuntime();
        return toContractDiff(path, await previewDiff(active.currentApi(), active.service.state, id, path));
      }),
  },
  {
    start: async () => {
      const context = mainContext();
      if (context.fixtures) return;
      const active = new SyncBackRuntime(context.configFile);
      runtime = active;
      const poll = () => void active.refresh().catch((error: unknown) => log.debug(`sync-back refresh failed: ${describeError(error)}`));
      watchFile(context.configFile, { interval: CONFIG_POLL_MS }, poll);
      poll();
      return () => {
        unwatchFile(context.configFile, poll);
        active.stop();
        for (const notification of notifications.values()) notification.close();
        notifications.clear();
        runtime = null;
      };
    },
  },
);
