import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { readConfig, updateConfig } from "../config";
import type { TokenCipher } from "../connection/token-vault";
import type {
  AddRouteRequest,
  CloudflareZone,
  ContainersActionKey,
  ContainersPhase,
  ContainersReport,
  CreateContainerRequest,
  DomainRoute,
  ServerContainer,
  TailscaleKeyRequest,
} from "../../shared/contracts/containers";
import type { CheckItem } from "../../shared/contracts/common";
import { IpcError } from "../../shared/ipc-types";
import { CloudflareApi, isManaged, type Fetch } from "./cloudflare";
import { CONFIG_KEYS, DEFAULT_TAILNET_TAGS, SECRET_ENV, SERVER_IMAGE, SERVER_IMAGE_DIR, STATE_FILE, TUNNEL_TARGET_SUFFIX } from "./constants";
import {
  buildServerImage,
  containerLogs,
  createContainer,
  ensureTunnel,
  findContainer,
  hasSysbox,
  imagePresent,
  listContainers,
  removeContainer,
  removeTunnel,
  restartContainer,
  serviceUrl,
  startContainer,
  stopContainer,
  type DockerDeps,
} from "./docker";
import { CHECK_LABELS, CONTAINERS_MESSAGES } from "./labels";
import { readSecret, storeSecret, type SecretKeys } from "./secrets";
import { publicRoute, readState, writeState, type ContainersState, type StoredRoute } from "./store";
import { validCpus, validHostname, validMemory, validName, validPort, zoneFor } from "./validate";

export interface ContainersServiceOptions {
  docker: DockerDeps;
  configFile: string;
  stateFile: string;
  contextDir: string;
  env: Record<string, string | undefined>;
  cipher: TokenCipher | null;
  seal: boolean;
  fetch?: Fetch;
  onContainers?(containers: ServerContainer[]): void;
  onRoutes?(routes: DomainRoute[]): void;
  onPhase?(phase: ContainersPhase): void;
}

const TAILSCALE_KEYS: SecretKeys = { plain: CONFIG_KEYS.tailscaleKey, sealed: CONFIG_KEYS.tailscaleKeySealed, env: SECRET_ENV.tailscaleKey };
const CLOUDFLARE_KEYS: SecretKeys = { plain: CONFIG_KEYS.cloudflareToken, sealed: CONFIG_KEYS.cloudflareTokenSealed, env: SECRET_ENV.cloudflareToken };

function cloudflareStatus(cloudflare: ContainersReport["cloudflare"]): "ok" | "warning" | "error" {
  if (cloudflare.error) return "error";
  return cloudflare.connected && cloudflare.zones.length > 0 ? "ok" : "warning";
}

export function stateFileIn(stateDir: string): string {
  return join(stateDir, STATE_FILE);
}

export function serverImageDir(contextDir: string): string {
  return join(contextDir, ...SERVER_IMAGE_DIR);
}

export class ContainersService {
  private phaseValue: ContainersPhase = { kind: "idle" };
  private operation: AbortController | null = null;
  private routeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: ContainersServiceOptions) {}

  phase(): ContainersPhase {
    return this.phaseValue;
  }

  cancel(): ContainersPhase {
    this.operation?.abort();
    return this.phaseValue;
  }

  private setPhase(phase: ContainersPhase): void {
    this.phaseValue = phase;
    this.options.onPhase?.(phase);
  }

  private async exclusive<T>(phase: ContainersPhase, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.operation) throw new IpcError("unavailable", CONTAINERS_MESSAGES.busy);
    const controller = new AbortController();
    this.operation = controller;
    this.setPhase(phase);
    try {
      return await run(controller.signal);
    } finally {
      this.operation = null;
      this.setPhase({ kind: "idle" });
    }
  }

  private serialRoutes<T>(run: () => Promise<T>): Promise<T> {
    const next = this.routeQueue.then(run);
    this.routeQueue = next.catch(() => undefined);
    return next;
  }

  private async secret(keys: SecretKeys): Promise<string | null> {
    return readSecret(await readConfig(this.options.configFile), keys, this.options.env, this.options.cipher);
  }

  private async saveSecret(keys: SecretKeys, value: string | null, extra: Record<string, unknown> = {}): Promise<void> {
    await updateConfig(this.options.configFile, (data) => ({ ...storeSecret(data, keys, value, this.options.seal ? this.options.cipher : null), ...extra }));
  }

  private async tailnetTags(): Promise<string> {
    const value = (await readConfig(this.options.configFile))[CONFIG_KEYS.tailscaleTags];
    return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_TAILNET_TAGS;
  }

  private async cloudflare(): Promise<CloudflareApi> {
    const token = await this.secret(CLOUDFLARE_KEYS);
    if (!token) throw new IpcError("unavailable", CONTAINERS_MESSAGES.noCloudflare);
    return new CloudflareApi(token, this.options.fetch);
  }

  async report(): Promise<ContainersReport> {
    const [sysbox, image, tailscaleKey, tags, cloudflare] = await Promise.all([
      hasSysbox(this.options.docker),
      imagePresent(this.options.docker),
      this.secret(TAILSCALE_KEYS),
      this.tailnetTags(),
      this.cloudflareStatus(),
    ]);
    const checks: CheckItem<ContainersActionKey>[] = [
      { id: "sysbox", status: sysbox ? "ok" : "error", title: CHECK_LABELS.sysbox.title, detail: sysbox ? CHECK_LABELS.sysbox.ok : CHECK_LABELS.sysbox.missing, action: sysbox ? undefined : "install-sysbox" },
      { id: "image", status: image ? "ok" : "warning", title: CHECK_LABELS.image.title, detail: image ? CHECK_LABELS.image.ok(SERVER_IMAGE) : CHECK_LABELS.image.missing, action: image ? undefined : "build-image" },
      { id: "tailscale", status: tailscaleKey ? "ok" : "warning", title: CHECK_LABELS.tailscale.title, detail: tailscaleKey ? CHECK_LABELS.tailscale.ok(tags) : CHECK_LABELS.tailscale.missing, action: "tailscale-key" },
      { id: "cloudflare", status: cloudflareStatus(cloudflare), title: CHECK_LABELS.cloudflare.title, detail: cloudflare.error ?? (!cloudflare.connected ? CHECK_LABELS.cloudflare.missing : cloudflare.zones.length ? CHECK_LABELS.cloudflare.ok(cloudflare.zones.length) : CHECK_LABELS.cloudflare.noZones), action: "cloudflare-token" },
    ];
    return { sysbox, image: image ? SERVER_IMAGE : null, tailscaleKey: Boolean(tailscaleKey), tailscaleTags: tags, cloudflare, checks };
  }

  private async cloudflareStatus(): Promise<ContainersReport["cloudflare"]> {
    const token = await this.secret(CLOUDFLARE_KEYS);
    if (!token) return { connected: false, zones: [], error: null };
    try {
      return { connected: true, zones: await new CloudflareApi(token, this.options.fetch).zones(), error: null };
    } catch (error) {
      return { connected: false, zones: [], error: error instanceof Error ? error.message : String(error) };
    }
  }

  async list(): Promise<ServerContainer[]> {
    const containers = await listContainers(this.options.docker);
    this.options.onContainers?.(containers);
    return containers;
  }

  private async changed(name: string): Promise<ServerContainer> {
    const containers = await this.list();
    const found = containers.find((container) => container.name === name);
    if (!found) throw new IpcError("not_found", CONTAINERS_MESSAGES.notFound(name));
    return found;
  }

  async buildImage(): Promise<ContainersReport> {
    await this.exclusive({ kind: "building", step: "" }, (signal) =>
      buildServerImage(this.options.docker, serverImageDir(this.options.contextDir), signal, (step) => this.setPhase({ kind: "building", step })),
    );
    return this.report();
  }

  async create(request: CreateContainerRequest): Promise<ServerContainer> {
    const name = validName(request?.name);
    const cpus = validCpus(request.cpus);
    const memoryMb = validMemory(request.memoryMb);
    if (!(await hasSysbox(this.options.docker))) throw new IpcError("unavailable", CONTAINERS_MESSAGES.noSysbox);
    if (!(await imagePresent(this.options.docker))) throw new IpcError("unavailable", CONTAINERS_MESSAGES.noImage);
    const authKey = await this.secret(TAILSCALE_KEYS);
    const tags = await this.tailnetTags();
    await this.exclusive({ kind: "creating", name }, () =>
      createContainer(this.options.docker, { name, cpus, memoryMb, tailnet: authKey ? { authKey, tags } : null }),
    );
    return this.changed(name);
  }

  async start(name: string): Promise<ServerContainer> {
    const target = validName(name);
    await startContainer(this.options.docker, target);
    return this.changed(target);
  }

  async stop(name: string): Promise<ServerContainer> {
    const target = validName(name);
    await stopContainer(this.options.docker, target);
    return this.changed(target);
  }

  async restart(name: string): Promise<ServerContainer> {
    const target = validName(name);
    await restartContainer(this.options.docker, target);
    return this.changed(target);
  }

  async remove(name: string): Promise<void> {
    const target = validName(name);
    await findContainer(this.options.docker, target);
    const routes = (await readState(this.options.stateFile)).routes.filter((route) => route.container === target);
    for (const route of routes) await this.removeRoute(route.id);
    await removeContainer(this.options.docker, target);
    await this.list();
  }

  logs(name: string): Promise<string[]> {
    return containerLogs(this.options.docker, validName(name));
  }

  async setTailscaleKey(request: TailscaleKeyRequest): Promise<ContainersReport> {
    const keep = request?.authKey === undefined;
    const key = request?.authKey?.trim() || null;
    if (key && !key.startsWith("tskey-")) throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.invalidTailscaleKey);
    const tags = request?.tags?.trim();
    if (tags && !/^tag:[a-z0-9-]+(,tag:[a-z0-9-]+)*$/i.test(tags)) throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.invalidTags);
    const extra = tags ? { [CONFIG_KEYS.tailscaleTags]: tags } : {};
    if (keep) await updateConfig(this.options.configFile, (data) => ({ ...data, ...extra }));
    else await this.saveSecret(TAILSCALE_KEYS, key, extra);
    return this.report();
  }

  async setCloudflareToken(token: string | null): Promise<ContainersReport> {
    const value = token?.trim() || null;
    if (value) {
      const api = new CloudflareApi(value, this.options.fetch);
      await api.verify();
      await api.zones();
    }
    await this.saveSecret(CLOUDFLARE_KEYS, value);
    return this.report();
  }

  async routes(): Promise<DomainRoute[]> {
    return (await readState(this.options.stateFile)).routes.map(publicRoute);
  }

  private async saveState(state: ContainersState): Promise<void> {
    await writeState(this.options.stateFile, state);
    this.options.onRoutes?.(state.routes.map(publicRoute));
  }

  private ingressFor(state: ContainersState, container: string) {
    return state.routes
      .filter((route) => route.container === container)
      .map((route) => ({ hostname: route.hostname, service: serviceUrl(route.container, route.port, route.scheme) }));
  }

  private async ensureTunnelRecord(api: CloudflareApi, state: ContainersState, container: string, zone: CloudflareZone) {
    const existing = state.tunnels[container];
    if (existing && (await api.tunnelExists(existing.accountId, existing.tunnelId))) {
      if (existing.accountId !== zone.accountId) throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.otherAccount);
      return existing;
    }
    const tunnelId = await api.createTunnel(zone.accountId, `tesseract-${container}-${randomBytes(3).toString("hex")}`);
    state.tunnels[container] = { accountId: zone.accountId, tunnelId };
    return state.tunnels[container];
  }

  addRoute(request: AddRouteRequest): Promise<DomainRoute> {
    return this.serialRoutes(async () => {
      const container = validName(request?.container);
      const hostname = validHostname(request.hostname);
      const port = validPort(request.port);
      const scheme = request.scheme === "https" ? "https" : "http";
      await findContainer(this.options.docker, container);
      const api = await this.cloudflare();
      const state = await readState(this.options.stateFile);
      if (state.routes.some((route) => route.hostname === hostname)) throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.routeExists(hostname));
      const zone = zoneFor(hostname, await api.zones());
      const records = await api.records(zone.id, hostname);
      if (records.some((record) => !isManaged(record))) throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.dnsTaken(hostname));
      this.setPhase({ kind: "routing", hostname });
      const tunnel = await this.ensureTunnelRecord(api, state, container, zone);
      const route: StoredRoute = {
        id: `rt_${randomBytes(8).toString("hex")}`,
        hostname,
        container,
        port,
        scheme,
        status: "pending",
        error: null,
        createdAt: new Date().toISOString(),
        zoneId: zone.id,
        recordId: null,
      };
      state.routes.push(route);
      await this.saveState(state);
      try {
        await api.putIngress(tunnel.accountId, tunnel.tunnelId, this.ingressFor(state, container));
        for (const stale of records) await api.deleteRecord(zone.id, stale.id);
        route.recordId = await api.createTunnelRecord(zone.id, hostname, tunnel.tunnelId, container);
        await ensureTunnel(this.options.docker, container, await api.tunnelToken(tunnel.accountId, tunnel.tunnelId));
        route.status = "active";
        await this.saveState(state);
        await this.list();
        return publicRoute(route);
      } catch (error) {
        state.routes = state.routes.filter((entry) => entry.id !== route.id);
        if (route.recordId) await api.deleteRecord(zone.id, route.recordId).catch(() => undefined);
        await api.putIngress(tunnel.accountId, tunnel.tunnelId, this.ingressFor(state, container)).catch(() => undefined);
        await this.saveState(state);
        throw error;
      } finally {
        this.setPhase({ kind: "idle" });
      }
    });
  }

  removeRoute(id: string): Promise<void> {
    return this.serialRoutes(async () => {
      const state = await readState(this.options.stateFile);
      const route = state.routes.find((entry) => entry.id === id);
      if (!route) throw new IpcError("not_found", CONTAINERS_MESSAGES.routeNotFound);
      const api = await this.cloudflare();
      const tunnel = state.tunnels[route.container];
      state.routes = state.routes.filter((entry) => entry.id !== id);
      if (route.recordId) {
        const record = (await api.records(route.zoneId, route.hostname)).find((entry) => entry.id === route.recordId);
        if (record && isManaged(record)) await api.deleteRecord(route.zoneId, record.id);
      }
      if (tunnel) {
        const remaining = this.ingressFor(state, route.container);
        if (remaining.length) await api.putIngress(tunnel.accountId, tunnel.tunnelId, remaining);
        else {
          await removeTunnel(this.options.docker, route.container);
          await api.deleteTunnel(tunnel.accountId, tunnel.tunnelId).catch(() => undefined);
          delete state.tunnels[route.container];
        }
      }
      await this.saveState(state);
      await this.list().catch(() => undefined);
    });
  }

  syncRoutes(): Promise<DomainRoute[]> {
    return this.serialRoutes(async () => {
      const state = await readState(this.options.stateFile);
      if (!state.routes.length) return [];
      const api = await this.cloudflare();
      for (const [container, tunnel] of Object.entries(state.tunnels)) {
        const routes = state.routes.filter((route) => route.container === container);
        try {
          if (!routes.length) continue;
          await api.putIngress(tunnel.accountId, tunnel.tunnelId, this.ingressFor(state, container));
          for (const route of routes) {
            const records = await api.records(route.zoneId, route.hostname);
            const ours = records.find((record) => isManaged(record) && record.content === `${tunnel.tunnelId}${TUNNEL_TARGET_SUFFIX}`);
            if (ours) route.recordId = ours.id;
            else if (records.some((record) => !isManaged(record))) throw new IpcError("unavailable", CONTAINERS_MESSAGES.dnsTaken(route.hostname));
            else route.recordId = await api.createTunnelRecord(route.zoneId, route.hostname, tunnel.tunnelId, container);
          }
          await ensureTunnel(this.options.docker, container, await api.tunnelToken(tunnel.accountId, tunnel.tunnelId));
          routes.forEach((route) => Object.assign(route, { status: "active", error: null }));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          routes.forEach((route) => Object.assign(route, { status: "error", error: message }));
        }
      }
      await this.saveState(state);
      return state.routes.map(publicRoute);
    });
  }
}
