import { join } from "node:path";
import type { WebContents } from "electron";
import { shouldSealTokens } from "../../core/connection";
import { ContainerShells, ContainersService, parseDockerHost, stateFileIn, type DockerEndpoint } from "../../core/containers";
import { effectiveEnv } from "../../core/docker";
import { LogRing } from "../../core/log";
import { CONFIG_FILE_NAME, stateDir } from "../../core/paths";
import { runCommand } from "../../core/process";
import { streamCommand } from "../../core/sandbox/spawn";
import type { OpenShellRequest } from "../../shared/contracts/containers";
import { eventChannel } from "../../shared/ipc";
import { IpcError } from "../../shared/ipc-types";
import { mainContext } from "../context";
import { sandboxContextDir } from "../services/resources";
import { tokenCipher } from "../services/token-cipher";
import { defineService } from "./_framework/define";
import { serviceEmitter } from "./_framework/events";

const events = serviceEmitter("containers");
const log = new LogRing();
let instance: ContainersService | null = null;
let shellSessions: ContainerShells | null = null;
const shellOwners = new Map<string, WebContents>();

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
    docker: {
      run: (file, args, options = {}) =>
        runCommand(file, args, { timeoutMs: options.timeoutMs, input: options.input, env: { ...effectiveEnv(), ...options.extraEnv } }),
      stream: (file, args, options = {}) => streamCommand(file, args, { ...options, env: effectiveEnv() }),
      log: pushLog,
    },
    configFile: context.configFile,
    stateFile: stateFileIn(stateDir(context.paths)),
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

function sendTo(sender: WebContents, event: "shellData" | "shellExit", payload: unknown): void {
  if (!sender.isDestroyed()) sender.send(eventChannel("containers", event), payload);
}

function ownedBy(sender: WebContents, id: unknown): string | null {
  return typeof id === "string" && shellOwners.get(id) === sender ? id : null;
}

async function openShell(sender: WebContents, request: OpenShellRequest): Promise<void> {
  if (typeof request !== "object" || request === null) throw new IpcError("invalid_argument", "openShell needs a request");
  const { id } = request;
  await shells().open(id, request.name, request, {
    data: (data) => sendTo(sender, "shellData", { id, data }),
    exit: (code) => {
      shellOwners.delete(id);
      sendTo(sender, "shellExit", { id, code });
    },
  });
  shellOwners.set(id, sender);
  sender.once("destroyed", () => {
    if (shellOwners.get(id) === sender) closeShell(id);
  });
}

function closeShell(id: string): void {
  shellOwners.delete(id);
  shells().close(id);
}

export default defineService("containers", {
  report: () => containersService().report(),
  list: () => containersService().list(),
  create: (_context, request) => containersService().create(request),
  start: (_context, name) => containersService().start(name),
  stop: (_context, name) => containersService().stop(name),
  restart: (_context, name) => containersService().restart(name),
  remove: (_context, name) => containersService().remove(name),
  logs: (_context, name) => containersService().logs(name),
  buildImage: () => containersService().buildImage(),
  cancel: () => containersService().cancel(),
  phase: () => containersService().phase(),
  setTailscaleKey: (_context, request) => containersService().setTailscaleKey(request),
  setCloudflareToken: (_context, token) => containersService().setCloudflareToken(token),
  routes: () => containersService().routes(),
  addRoute: (_context, request) => containersService().addRoute(request),
  removeRoute: (_context, id) => containersService().removeRoute(id),
  syncRoutes: () => containersService().syncRoutes(),
  openShell: ({ sender }, request) => openShell(sender, request),
  writeShell: ({ sender }, id, data) => {
    const owned = ownedBy(sender, id);
    if (owned) shells().write(owned, data);
  },
  resizeShell: async ({ sender }, id, cols, rows) => {
    const owned = ownedBy(sender, id);
    if (owned) await shells().resize(owned, { cols, rows });
  },
  closeShell: ({ sender }, id) => {
    const owned = ownedBy(sender, id);
    if (owned) closeShell(owned);
  },
}, {
  start: () => () => shellSessions?.closeAll(),
});
