import { join } from "node:path";
import type { WebContents } from "electron";
import { shouldSealTokens } from "../../core/connection";
import {
  ContainerShells,
  ContainersService,
  packFolder,
  parseDockerHost,
  remoteDocker,
  RemoteContainerShells,
  remoteStateFileIn,
  stateFileIn,
  type ContainersTarget,
  type DockerDeps,
  type DockerEndpoint,
} from "../../core/containers";
import { CONTAINERS_MESSAGES } from "../../core/containers/labels";
import { DEPLOY_MESSAGES } from "../../core/deploys";
import { effectiveEnv } from "../../core/docker";
import { LogRing } from "../../core/log";
import { CONFIG_FILE_NAME, stateDir } from "../../core/paths";
import { runCommand } from "../../core/process";
import { streamCommand } from "../../core/sandbox/spawn";
import type { OpenShellRequest } from "../../shared/contracts/containers";
import { eventChannel } from "../../shared/ipc";
import { IpcError } from "../../shared/ipc-types";
import { mainContext } from "../context";
import { deployService, startDeploys } from "../services/deploys";
import { sandboxContextDir } from "../services/resources";
import { tokenCipher } from "../services/token-cipher";
import { activeHost, currentHost, onActiveHostChanged, type ActiveHost } from "./hostShell";
import { defineService } from "./_framework/define";
import { serviceEmitter } from "./_framework/events";

const events = serviceEmitter("containers");
const log = new LogRing();
let instance: ContainersService | null = null;
let shellSessions: ContainerShells | null = null;
let remoteShellSessions: RemoteContainerShells | null = null;
let localDocker: DockerDeps | null = null;
let remoteTarget: { shell: unknown; target: ContainersTarget } | null = null;
const shellOwners = new Map<string, WebContents>();
const remoteShellIds = new Set<string>();

function pushLog(line: string): void {
  log.push(line).forEach((entry) => events.emit("log", entry));
}

export function containersService(): ContainersService {
  if (instance) return instance;
  const context = mainContext();
  const seal = shouldSealTokens({
    platform: process.platform,
    env: process.env,
    configFile: context.configFile,
    defaultConfigFile: join(context.paths.userData ?? "", CONFIG_FILE_NAME),
    test: context.isTest || context.fixtures,
    cipher: tokenCipher,
  });
  instance = new ContainersService({
    docker: local(),
    configFile: context.configFile,
    stateFile: stateFileIn(stateDir(context.paths)),
    target: () => containersTarget(currentHost()),
    contextDir: sandboxContextDir(),
    env: process.env,
    cipher: tokenCipher,
    seal,
    onContainers: (containers) => events.emit("containers", containers),
    onRoutes: (routes) => events.emit("routes", routes),
    onPhase: (phase) => events.emit("phase", phase),
  });
  return instance;
}

function local(): DockerDeps {
  localDocker ??= {
    run: (file, args, options = {}) =>
      runCommand(file, args, { timeoutMs: options.timeoutMs, input: options.input, env: { ...effectiveEnv(), ...options.extraEnv } }),
    stream: (file, args, options = {}) => streamCommand(file, args, { ...options, env: effectiveEnv() }),
    log: pushLog,
  };
  return localDocker;
}

/** Server containers follow the active machine: this computer's Docker, or the Tesseract server's through its linked host shell. */
function containersTarget(host: ActiveHost): ContainersTarget {
  const context = mainContext();
  if (host.kind === "local") return { docker: local(), stateFile: stateFileIn(stateDir(context.paths)), platform: process.platform };
  if (host.kind === "unlinked") throw new IpcError("unavailable", CONTAINERS_MESSAGES.remoteUnlinked);
  if (remoteTarget?.shell === host.shell) return remoteTarget.target;
  const { shell, label } = host;
  const url = shell.state().pairing?.url ?? label;
  const target: ContainersTarget = {
    docker: remoteDocker(() => ({ label, access: () => shell.sessionAccess(), rejected: () => shell.sessionRejected() }), { log: pushLog }),
    stateFile: remoteStateFileIn(stateDir(context.paths), url),
    platform: null,
    packContext: (dir) => packFolder(dir, (file, args, options) => runCommand(file, args, options)),
  };
  remoteTarget = { shell, target };
  return target;
}

/** Re-reads the active machine before a call, so it reaches the right Docker right after a switch. */
async function routed<T>(call: () => Promise<T> | T): Promise<T> {
  await activeHost();
  return call();
}

function hostChanged(): void {
  remoteShellSessions?.closeAll();
  remoteShellIds.clear();
  if (!instance) return;
  void instance.list().catch(() => undefined);
  void instance.routes().then((routes) => events.emit("routes", routes), () => undefined);
  void deployService()?.tick();
}

async function dockerEndpoint(): Promise<DockerEndpoint> {
  const env = effectiveEnv();
  if (env.DOCKER_HOST) return parseDockerHost(env.DOCKER_HOST, process.platform);
  const result = await runCommand("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], { timeoutMs: 5_000, env }).catch(() => null);
  return parseDockerHost(result?.code === 0 ? result.stdout : undefined, process.platform);
}

function shells(): ContainerShells {
  shellSessions ??= new ContainerShells({ endpoint: dockerEndpoint });
  return shellSessions;
}

function remoteShells(): RemoteContainerShells {
  remoteShellSessions ??= new RemoteContainerShells(() => {
    const host = currentHost();
    if (host.kind !== "remote") throw new IpcError("unavailable", CONTAINERS_MESSAGES.remoteUnlinked);
    return host.shell;
  });
  return remoteShellSessions;
}

/** The shells backend that owns `id` (remote ids are remembered when opened). */
function shellsFor(id: string): ContainerShells | RemoteContainerShells {
  return remoteShellIds.has(id) ? remoteShells() : shells();
}

function requireDeploys() {
  const service = deployService();
  if (!service) throw new IpcError("unavailable", DEPLOY_MESSAGES.notConnected);
  return service;
}

async function setAutoDeploy(name: string, enabled: boolean) {
  const container = await containersService().setAutoDeploy(name, enabled);
  void deployService()?.tick();
  return container;
}

function sendTo(sender: WebContents, event: "shellData" | "shellExit", payload: unknown): void {
  if (!sender.isDestroyed()) sender.send(eventChannel("containers", event), payload);
}

function ownedBy(sender: WebContents, id: unknown): string | null {
  return typeof id === "string" && shellOwners.get(id) === sender ? id : null;
}

async function openShell(sender: WebContents, request: OpenShellRequest): Promise<void> {
  if (typeof request !== "object" || request === null) throw new IpcError("invalid_argument", "openShell needs a request");
  const { id } = request;
  const host = await activeHost();
  if (host.kind === "unlinked") throw new IpcError("unavailable", CONTAINERS_MESSAGES.remoteUnlinked);
  const backend = host.kind === "remote" ? remoteShells() : shells();
  await backend.open(id, request.name, request, {
    data: (data) => sendTo(sender, "shellData", { id, data }),
    exit: (code) => {
      shellOwners.delete(id);
      remoteShellIds.delete(id);
      sendTo(sender, "shellExit", { id, code });
    },
  });
  if (host.kind === "remote") remoteShellIds.add(id);
  shellOwners.set(id, sender);
  sender.once("destroyed", () => {
    if (shellOwners.get(id) === sender) closeShell(id);
  });
}

function closeShell(id: string): void {
  shellOwners.delete(id);
  shellsFor(id).close(id);
  remoteShellIds.delete(id);
}

export default defineService("containers", {
  report: () => routed(() => containersService().report()),
  list: () => routed(() => containersService().list()),
  create: (_context, request) => routed(() => containersService().create(request)),
  start: (_context, name) => routed(() => containersService().start(name)),
  stop: (_context, name) => routed(() => containersService().stop(name)),
  restart: (_context, name) => routed(() => containersService().restart(name)),
  remove: (_context, name) => routed(() => containersService().remove(name)),
  logs: (_context, name) => routed(() => containersService().logs(name)),
  buildImage: () => routed(() => containersService().buildImage()),
  setupVm: () => routed(() => containersService().setupVm()),
  cancel: () => containersService().cancel(),
  phase: () => containersService().phase(),
  setTailscaleKey: (_context, request) => routed(() => containersService().setTailscaleKey(request)),
  setCloudflareToken: (_context, token) => routed(() => containersService().setCloudflareToken(token)),
  routes: () => routed(() => containersService().routes()),
  addRoute: (_context, request) => routed(() => containersService().addRoute(request)),
  removeRoute: (_context, id) => routed(() => containersService().removeRoute(id)),
  syncRoutes: () => routed(() => containersService().syncRoutes()),
  openShell: ({ sender }, request) => openShell(sender, request),
  writeShell: ({ sender }, id, data) => {
    const owned = ownedBy(sender, id);
    if (owned) shellsFor(owned).write(owned, data);
  },
  resizeShell: async ({ sender }, id, cols, rows) => {
    const owned = ownedBy(sender, id);
    if (owned) await shellsFor(owned).resize(owned, { cols, rows });
  },
  closeShell: ({ sender }, id) => {
    const owned = ownedBy(sender, id);
    if (owned) closeShell(owned);
  },
  setAutoDeploy: (_context, name, enabled) => routed(() => setAutoDeploy(name, enabled)),
  deploys: () => deployService()?.deploys() ?? [],
  approveDeploy: (_context, id) => requireDeploys().approve(id),
  rejectDeploy: (_context, id) => requireDeploys().reject(id),
}, {
  start: () => {
    const context = mainContext();
    const stopDeploys = context.fixtures ? null : startDeploys(context.configFile, containersService(), (deploys) => events.emit("deploys", deploys));
    const stopFollowing = onActiveHostChanged(hostChanged);
    return () => {
      stopFollowing();
      stopDeploys?.();
      shellSessions?.closeAll();
      remoteShellSessions?.closeAll();
    };
  },
});
