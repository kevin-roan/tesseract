import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError } from "@tesseract/client";
import { LIMITS, type CompleteDeploy, type Deploy, type DeployTarget } from "@tesseract/protocol";
import type { CreateContainerRequest, DomainRoute, HostDeploy, ServerContainer } from "../../shared/contracts/containers";
import { IpcError } from "../../shared/ipc-types";
import type { DeployRequest } from "../containers/service";
import { createLogger } from "../log";
import type { DeployApi, DownloadedBundle } from "./api";
import { BUNDLE_FILE, CONFLICT_STATUS, HEARTBEAT_INTERVAL_MS, LOG_FLUSH_MS, SEEN_LIMIT, TEMP_PREFIX } from "./constants";
import { DEPLOY_MESSAGES, DEPLOY_TITLES } from "./labels";
import { LogPump } from "./log-pump";

export interface DeployContainers {
  list(): Promise<ServerContainer[]>;
  routes(): Promise<DomainRoute[]>;
  create(request: CreateContainerRequest): Promise<ServerContainer>;
  deploy(request: DeployRequest, onLine: (line: string) => void, signal?: AbortSignal): Promise<string[]>;
}

export interface DeployServiceOptions {
  api: () => DeployApi | null;
  host: string;
  sandbox: () => string;
  containers: DeployContainers;
  notify(id: string, title: string, body: string): void;
  onChange?(deploys: HostDeploy[]): void;
  intervalMs?: number;
  logFlushMs?: number;
  tempDir?: string;
}

export interface DeployEventLike {
  type: string;
  deploy?: unknown;
}

const log = createLogger("deploys");

function isDeploy(value: unknown): value is Deploy {
  return typeof value === "object" && value !== null && typeof (value as Deploy).id === "string" && typeof (value as Deploy).status === "string";
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function tail(text: string, limit: number): string {
  return text.length > limit ? text.slice(-limit) : text;
}

export function verifyBundle(deploy: Pick<Deploy, "bytes" | "sha256">, bundle: DownloadedBundle): void {
  if (bundle.bytes !== deploy.bytes) throw new IpcError("invalid_argument", DEPLOY_MESSAGES.sizeMismatch(deploy.bytes, bundle.bytes));
  if (bundle.sha256 !== deploy.sha256 || (bundle.header !== null && bundle.header !== deploy.sha256)) throw new IpcError("invalid_argument", DEPLOY_MESSAGES.shaMismatch);
}

export function deployTargets(containers: readonly ServerContainer[], routes: readonly DomainRoute[]): DeployTarget[] {
  return containers.slice(0, LIMITS.maxDeployTargets).map((container) => ({
    name: container.name,
    running: container.state === "running",
    autoApprove: container.autoDeploy,
    urls: routes
      .filter((route) => route.container === container.name && route.status === "active")
      .map((route) => `https://${route.hostname}`)
      .slice(0, LIMITS.maxDeployTargets),
  }));
}

export class DeployService {
  private readonly recent = new Map<string, HostDeploy>();
  private readonly seen = new Set<string>();
  private readonly waiting = new Map<string, Deploy>();
  private readonly running = new Map<string, AbortController>();
  private readonly queues = new Map<string, Promise<void>>();
  private readonly tasks = new Set<Promise<unknown>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private online = false;

  constructor(private readonly options: DeployServiceOptions) {}

  deploys(): HostDeploy[] {
    return [...this.recent.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  setOnline(online: boolean): void {
    this.online = online;
    if (online && this.timer === null) {
      this.timer = setInterval(() => void this.tick(), this.options.intervalMs ?? HEARTBEAT_INTERVAL_MS);
      void this.tick();
    } else if (!online) {
      this.stop();
    }
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  reset(): void {
    this.stop();
    this.online = false;
    for (const controller of this.running.values()) controller.abort();
    this.waiting.clear();
    this.seen.clear();
    this.recent.clear();
    this.changed();
  }

  handleEvent(event: DeployEventLike): void {
    if (event.type === "deploy.updated" && isDeploy(event.deploy)) {
      this.record(event.deploy);
      if (event.deploy.status === "pending") this.track(this.consider(event.deploy));
    } else if (event.type === "hello") {
      void this.tick();
    }
  }

  async tick(): Promise<void> {
    if (!this.online) return;
    const api = this.options.api();
    if (!api) return;
    try {
      await this.beat(api);
    } catch (error) {
      log.debug(`deploy targets heartbeat failed: ${message(error)}`);
    }
    try {
      const pending = await api.list({ status: "pending" });
      for (const deploy of [...pending].reverse()) {
        this.record(deploy);
        this.track(this.consider(deploy));
      }
    } catch (error) {
      log.debug(`listing pending deploys failed: ${message(error)}`);
    }
  }

  private async beat(api: DeployApi): Promise<void> {
    const [containers, routes] = await Promise.all([this.options.containers.list(), this.options.containers.routes()]);
    await api.putTargets({ host: this.options.host, targets: deployTargets(containers, routes) });
  }

  async approve(id: string): Promise<void> {
    const deploy = this.waiting.get(id);
    if (!deploy) throw new IpcError("not_found", DEPLOY_MESSAGES.notWaiting);
    this.waiting.delete(id);
    this.schedule(deploy);
  }

  async reject(id: string): Promise<void> {
    const deploy = this.waiting.get(id);
    if (!deploy) throw new IpcError("not_found", DEPLOY_MESSAGES.notWaiting);
    this.waiting.delete(id);
    try {
      this.record(await this.requireApi().complete(id, { status: "rejected" }));
    } catch (error) {
      if (!(error instanceof ApiError && error.status === CONFLICT_STATUS)) throw error;
    }
  }

  async idle(): Promise<void> {
    while (this.tasks.size) await Promise.allSettled([...this.tasks]);
  }

  private track(task: Promise<unknown>): void {
    this.tasks.add(task);
    void task.finally(() => this.tasks.delete(task));
  }

  private requireApi(): DeployApi {
    const api = this.options.api();
    if (!api) throw new IpcError("unavailable", DEPLOY_MESSAGES.notConnected);
    return api;
  }

  private changed(): void {
    this.options.onChange?.(this.deploys());
  }

  private record(deploy: Deploy): Deploy {
    const known = this.recent.get(deploy.id);
    if (known && known.updatedAt > deploy.updatedAt) return deploy;
    this.recent.set(deploy.id, { ...deploy, sandbox: this.options.sandbox() });
    if (deploy.status !== "awaiting_approval" && deploy.status !== "claimed") this.waiting.delete(deploy.id);
    if (deploy.status === "cancelled") this.running.get(deploy.id)?.abort();
    while (this.recent.size > LIMITS.maxDeployList) {
      const oldest = this.deploys().at(-1);
      if (!oldest) break;
      this.recent.delete(oldest.id);
    }
    this.changed();
    return deploy;
  }

  private remember(id: string): void {
    this.seen.add(id);
    while (this.seen.size > SEEN_LIMIT) this.seen.delete(this.seen.values().next().value as string);
  }

  private async consider(deploy: Deploy): Promise<void> {
    if (deploy.status !== "pending" || this.seen.has(deploy.id)) return;
    const api = this.options.api();
    if (!api) return;
    this.remember(deploy.id);
    try {
      this.record(await api.claim(deploy.id, this.options.host));
    } catch (error) {
      if (!(error instanceof ApiError)) this.seen.delete(deploy.id);
      log.debug(`deploy ${deploy.id} not claimed: ${message(error)}`);
      return;
    }
    try {
      await this.accept(api, deploy.id);
    } catch (error) {
      this.waiting.delete(deploy.id);
      await this.fail(api, deploy, error, "");
    }
  }

  private async accept(api: DeployApi, id: string): Promise<void> {
    const deploy = this.record(await api.get(id));
    const container = await this.find(deploy.container);
    if (!container && !deploy.create) {
      await this.fail(api, deploy, new IpcError("not_found", DEPLOY_MESSAGES.noContainer(deploy.container)), "");
      return;
    }
    if (container?.autoDeploy) {
      this.schedule(deploy);
      return;
    }
    this.waiting.set(id, deploy);
    this.record(await api.progress(id, { status: "awaiting_approval" }));
    if (!this.waiting.has(id)) return;
    const sandbox = this.options.sandbox();
    if (container) this.notify(id, DEPLOY_TITLES.approval(deploy.app, deploy.container), DEPLOY_TITLES.approvalBody(sandbox, deploy.hostname));
    else this.notify(id, DEPLOY_TITLES.create(deploy.container, deploy.app), DEPLOY_TITLES.createBody(sandbox, deploy.hostname));
  }

  private async find(name: string): Promise<ServerContainer | undefined> {
    return (await this.options.containers.list()).find((entry) => entry.name === name);
  }

  private async prepare(api: DeployApi, deploy: Deploy, pump: LogPump): Promise<void> {
    if (!deploy.create || (await this.find(deploy.container))) {
      this.record(await api.progress(deploy.id, { status: "deploying" }));
      return;
    }
    this.record(await api.progress(deploy.id, { status: "deploying", log: DEPLOY_MESSAGES.creating(deploy.container) }));
    await this.options.containers.create({ name: deploy.container, cpus: deploy.cpus, memoryMb: deploy.memoryMb });
    pump.push(DEPLOY_MESSAGES.created(deploy.container));
  }

  private schedule(deploy: Deploy): void {
    const previous = this.queues.get(deploy.container) ?? Promise.resolve();
    const next = previous.then(() => this.run(deploy));
    this.queues.set(deploy.container, next);
    this.track(
      next.finally(() => {
        if (this.queues.get(deploy.container) === next) this.queues.delete(deploy.container);
      }),
    );
  }

  private async run(deploy: Deploy): Promise<void> {
    const controller = new AbortController();
    this.running.set(deploy.id, controller);
    const api = this.options.api();
    if (!api) {
      this.running.delete(deploy.id);
      return;
    }
    const pump = new LogPump(async (chunk) => {
      this.record(await api.progress(deploy.id, { status: "deploying", log: chunk }));
    }, this.options.logFlushMs ?? LOG_FLUSH_MS);
    let dir: string | null = null;
    try {
      if (controller.signal.aborted) return;
      await this.prepare(api, deploy, pump);
      dir = await mkdtemp(join(this.options.tempDir ?? tmpdir(), TEMP_PREFIX));
      const bundle = join(dir, BUNDLE_FILE);
      verifyBundle(deploy, await api.download(deploy.id, bundle));
      const request: DeployRequest = { container: deploy.container, app: deploy.app, kind: deploy.kind, port: deploy.port, hostname: deploy.hostname, bundle };
      const urls = await this.options.containers.deploy(request, (line) => pump.push(line), controller.signal);
      await pump.settle();
      const rest = pump.take();
      this.record(await api.complete(deploy.id, { status: "deployed", urls, ...(rest ? { log: rest } : {}) }));
      this.notify(deploy.id, DEPLOY_TITLES.deployed(deploy.app, deploy.container), DEPLOY_TITLES.deployedBody(urls));
    } catch (error) {
      await pump.settle();
      if (controller.signal.aborted) log.debug(`deploy ${deploy.id} was cancelled`);
      else await this.fail(api, deploy, error, pump.take());
    } finally {
      pump.take();
      this.running.delete(deploy.id);
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async fail(api: DeployApi, deploy: Deploy, error: unknown, output: string): Promise<void> {
    if (error instanceof ApiError && error.status === CONFLICT_STATUS) {
      log.debug(`deploy ${deploy.id} was taken or cancelled: ${error.message}`);
      return;
    }
    const reason = message(error);
    const body: CompleteDeploy = { status: "failed", error: tail(reason, LIMITS.maxStatusMessageLength), log: tail(`${output}${reason}\n`, LIMITS.maxDeployLogLength) };
    try {
      this.record(await api.complete(deploy.id, body));
    } catch (completeError) {
      log.debug(`could not report the failed deploy ${deploy.id}: ${message(completeError)}`);
    }
    this.notify(deploy.id, DEPLOY_TITLES.failed(deploy.app, deploy.container), reason);
  }

  private notify(id: string, title: string, body: string): void {
    try {
      this.options.notify(id, title, body);
    } catch (error) {
      log.debug(`could not send a notification: ${message(error)}`);
    }
  }
}
