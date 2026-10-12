import { posix } from "node:path";
import { commandError, type CommandResult } from "../process";
import type { DockerPhase } from "../../shared/contracts/docker";
import type { VmSize, VmStatus, VmTools } from "../../shared/contracts/vm";
import { IpcError } from "../../shared/ipc-types";
import { GIB } from "../docker/constants";
import { LOG_MESSAGES } from "../docker/labels";
import { applyPathFix } from "../docker/path-fix";
import { createRuntime, describeCommand, isCancelled, runLogged, runQuiet, streamLogged, throwIfAborted, type DockerRuntime } from "../docker/runtime";
import type { DockerHost, DockerSystem } from "../docker/system";
import { colimaConfig, colimaConfigPath, colimaHome, configSize, isManagedConfig, resolveSize, sameManagedConfig, vmArch } from "./config";
import { sysboxProvisionScript } from "./provision";
import {
  BREW_CANDIDATES,
  BREW_INSTALL_COMMAND,
  BREW_INSTALL_TIMEOUT_MS,
  BREW_TOOLS,
  CLI_PLUGINS_DIR,
  CLI_PLUGINS_KEY,
  CREDS_STORE_KEY,
  DESKTOP_CREDS_STORE,
  COLIMA_LOG_LINE,
  COLIMA_SOCKET_FILE,
  COLIMA_SSH,
  COLIMA_STATUS,
  DOCKER_CONFIG_DIR,
  DOCKER_CONFIG_ENV,
  DOCKER_CONFIG_FILE,
  DOCKER_DESKTOP_PROCESSES,
  SYSBOX_POLL_MS,
  SYSBOX_PROVISION_TIMEOUT_MS,
  SYSBOX_RUNTIME,
  SYSBOX_SERVICES,
  SYSBOX_SETTLE_MS,
  SYSBOX_WAIT_MS,
  VM_COMMANDS,
  VM_CONTEXT,
  VM_DEFAULT_SIZE,
  VM_PROFILE,
  VM_START_TIMEOUT_MS,
  VM_STOP_TIMEOUT_MS,
} from "./constants";
import { VM_LOG_MESSAGES, VM_MESSAGES } from "./labels";

export interface VmOptions {
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  onLog?(line: string): void;
  system?: Partial<DockerSystem>;
  host?: Partial<DockerHost>;
}

export interface VmSetupRequest {
  resourcesDir: string;
  size?: Partial<VmSize>;
}

export interface ColimaInstance {
  name: string;
  status: string;
  cpus: number;
  memory: number;
  disk: number;
}

const NO_TOOLS: VmTools = { brew: null, colima: null, limactl: null, docker: null, compose: null, buildx: null };

function blocked(reason: string, commands?: string[]): DockerPhase {
  return commands ? { kind: "blocked", reason, commands } : { kind: "blocked", reason };
}

function findBrew(runtime: DockerRuntime): string | null {
  return BREW_CANDIDATES.find((path) => runtime.system.exists(path)) ?? runtime.system.which("brew", runtime.env, runtime.host.platform);
}

function brewPrefix(brew: string): string {
  return posix.dirname(posix.dirname(brew));
}

export function prepareEnv(runtime: DockerRuntime): string | null {
  runtime.env = applyPathFix(runtime.env, runtime.host.platform, runtime.host.home, (path) => runtime.system.exists(path));
  const brew = findBrew(runtime);
  if (!brew) return null;
  const bin = posix.dirname(brew);
  const current = (runtime.env.PATH ?? "").split(":").filter(Boolean);
  if (!current.includes(bin)) runtime.env = { ...runtime.env, PATH: [bin, ...current].join(":") };
  return brew;
}

function pluginPath(runtime: DockerRuntime, prefix: string | null, binary: string): string | null {
  const dirs = [prefix && posix.join(prefix, CLI_PLUGINS_DIR), posix.join(posix.dirname(dockerConfigPath(runtime.env, runtime.host.home)), "cli-plugins")];
  for (const dir of dirs) {
    const path = dir && posix.join(dir, binary);
    if (path && runtime.system.exists(path)) return path;
  }
  return null;
}

export function readTools(runtime: DockerRuntime, brew: string | null): VmTools {
  const prefix = brew ? brewPrefix(brew) : null;
  const which = (name: string) => {
    const found = runtime.system.which(name, runtime.env, runtime.host.platform);
    if (found) return found;
    const candidate = prefix ? posix.join(prefix, "bin", name) : null;
    return candidate && runtime.system.exists(candidate) ? candidate : null;
  };
  return {
    brew,
    colima: which("colima"),
    limactl: which("limactl"),
    docker: which("docker"),
    compose: pluginPath(runtime, prefix, "docker-compose") ?? which("docker-compose"),
    buildx: pluginPath(runtime, prefix, "docker-buildx") ?? which("docker-buildx"),
  };
}

export function missingFormulas(tools: VmTools): string[] {
  return BREW_TOOLS.filter((tool) => !tools[tool.key]).map((tool) => tool.formula);
}

export function parseColimaList(stdout: string): ColimaInstance[] {
  const instances: ColimaInstance[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line) as Partial<Record<keyof ColimaInstance, unknown>>;
      if (typeof data.name !== "string") continue;
      instances.push({
        name: data.name,
        status: typeof data.status === "string" ? data.status : "",
        cpus: Number(data.cpus) || 0,
        memory: Number(data.memory) || 0,
        disk: Number(data.disk) || 0,
      });
    } catch {}
  }
  return instances;
}

export function parseRuntimes(stdout: string): string[] {
  try {
    const data = JSON.parse(stdout.trim()) as unknown;
    return data && typeof data === "object" ? Object.keys(data) : [];
  } catch {
    return [];
  }
}

async function readInstance(runtime: DockerRuntime, colima: string): Promise<ColimaInstance | null> {
  const result = await runQuiet(runtime, colima, ["list", "--json"]);
  if (result.code !== 0) return null;
  return parseColimaList(result.stdout).find((instance) => instance.name === VM_PROFILE) ?? null;
}

export function parseActiveServices(stdout: string): boolean {
  const states = stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  return states.length === SYSBOX_SERVICES.length && states.every((state) => state === "active");
}

async function hasSysboxRuntime(runtime: DockerRuntime, docker: string): Promise<boolean> {
  const result = await runQuiet(runtime, docker, ["--context", VM_CONTEXT, "info", "--format", "{{json .Runtimes}}"]);
  return result.code === 0 && parseRuntimes(result.stdout).includes(SYSBOX_RUNTIME);
}

async function sysboxServicesActive(runtime: DockerRuntime, colima: string): Promise<boolean> {
  const result = await runQuiet(runtime, colima, [...COLIMA_SSH, "systemctl", "is-active", ...SYSBOX_SERVICES]);
  return result.code === 0 && parseActiveServices(result.stdout);
}

async function hasSysbox(runtime: DockerRuntime, colima: string, docker: string): Promise<boolean> {
  return (await hasSysboxRuntime(runtime, docker)) && (await sysboxServicesActive(runtime, colima));
}

async function dockerDesktopRunning(runtime: DockerRuntime): Promise<boolean> {
  for (const name of DOCKER_DESKTOP_PROCESSES) {
    if ((await runQuiet(runtime, "pgrep", ["-x", name])).code === 0) return true;
  }
  return false;
}

function instanceSize(instance: ColimaInstance): VmSize {
  return {
    cpus: instance.cpus || VM_DEFAULT_SIZE.cpus,
    memoryGb: instance.memory ? Math.round((instance.memory / GIB) * 10) / 10 : VM_DEFAULT_SIZE.memoryGb,
    diskGb: instance.disk ? Math.round(instance.disk / GIB) : VM_DEFAULT_SIZE.diskGb,
  };
}

export async function statusWithRuntime(runtime: DockerRuntime): Promise<VmStatus> {
  const base: VmStatus = {
    state: "unsupported",
    profile: VM_PROFILE,
    context: VM_CONTEXT,
    tools: NO_TOOLS,
    sysbox: false,
    activeContext: null,
    active: false,
    size: VM_DEFAULT_SIZE,
    dockerDesktopRunning: false,
  };
  if (runtime.host.platform !== "darwin") return base;
  const tools = readTools(runtime, prepareEnv(runtime));
  const instance = tools.colima ? await readInstance(runtime, tools.colima) : null;
  const state = !instance ? "missing" : instance.status === COLIMA_STATUS.running ? "running" : "stopped";
  const size = instance ? instanceSize(instance) : configSize(await runtime.system.readText(colimaConfigPath(runtime.env, runtime.host.home)));
  const activeContext = tools.docker ? (await runQuiet(runtime, tools.docker, ["context", "show"])).stdout.trim() || null : null;
  const sysbox = state === "running" && tools.colima && tools.docker ? await hasSysbox(runtime, tools.colima, tools.docker) : false;
  return {
    ...base,
    state,
    tools,
    sysbox,
    activeContext,
    active: activeContext === VM_CONTEXT,
    size,
    dockerDesktopRunning: await dockerDesktopRunning(runtime),
  };
}

async function installTools(runtime: DockerRuntime, brew: string): Promise<DockerPhase | VmTools> {
  let tools = readTools(runtime, brew);
  const missing = missingFormulas(tools);
  if (!missing.length) {
    runtime.log(VM_LOG_MESSAGES.toolsPresent);
    return tools;
  }
  runtime.phase({ kind: "installing", stage: "installing", received: 0, total: null });
  runtime.log(VM_LOG_MESSAGES.installingTools(missing));
  const args = ["install", ...missing];
  const result = await streamLogged(runtime, brew, args, BREW_INSTALL_TIMEOUT_MS);
  throwIfAborted(runtime, VM_MESSAGES.cancelled);
  prepareEnv(runtime);
  tools = readTools(runtime, brew);
  if (result.code !== 0 || missingFormulas(tools).length) {
    return blocked(VM_MESSAGES.brewFailed(commandError("brew", args, result)), [`brew ${args.join(" ")}`]);
  }
  return tools;
}

export function dockerConfigPath(env: NodeJS.ProcessEnv, home: string): string {
  const dir = env[DOCKER_CONFIG_ENV] || posix.join(home, DOCKER_CONFIG_DIR);
  return posix.join(dir, DOCKER_CONFIG_FILE);
}

export function mergePluginsDir(text: string | null, dir: string): string | null {
  let data: Record<string, unknown> = {};
  if (text?.trim()) {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new SyntaxError("not an object");
    data = parsed as Record<string, unknown>;
  }
  const current = Array.isArray(data[CLI_PLUGINS_KEY]) ? (data[CLI_PLUGINS_KEY] as unknown[]) : [];
  const desktopCreds = data[CREDS_STORE_KEY] === DESKTOP_CREDS_STORE;
  if (current.includes(dir) && !desktopCreds) return null;
  const next: Record<string, unknown> = { ...data, [CLI_PLUGINS_KEY]: current.includes(dir) ? current : [...current, dir] };
  if (desktopCreds) delete next[CREDS_STORE_KEY];
  return `${JSON.stringify(next, null, "\t")}\n`;
}

async function ensurePluginsDir(runtime: DockerRuntime, brew: string): Promise<void> {
  const file = dockerConfigPath(runtime.env, runtime.host.home);
  const dir = posix.join(brewPrefix(brew), CLI_PLUGINS_DIR);
  let next: string | null;
  try {
    next = mergePluginsDir(await runtime.system.readText(file), dir);
  } catch {
    runtime.log(VM_LOG_MESSAGES.dockerConfigInvalid(file));
    return;
  }
  if (!next) return;
  await runtime.system.writeText(file, next);
  runtime.log(VM_LOG_MESSAGES.pluginsDir(dir, file));
}

async function writeColimaConfig(runtime: DockerRuntime, request: VmSetupRequest): Promise<void> {
  const file = colimaConfigPath(runtime.env, runtime.host.home);
  const existing = await runtime.system.readText(file);
  if (existing !== null && !isManagedConfig(existing)) {
    runtime.log(VM_LOG_MESSAGES.configUserOwned(file));
    return;
  }
  const next = colimaConfig({
    arch: vmArch(runtime.host.arch),
    size: resolveSize(request.size),
    home: runtime.host.home,
    resourcesDir: request.resourcesDir,
  });
  if (existing !== null && sameManagedConfig(existing, next)) {
    runtime.log(VM_LOG_MESSAGES.configCurrent(file));
    return;
  }
  await runtime.system.writeText(file, next);
  runtime.log(VM_LOG_MESSAGES.configWritten(file));
}

async function waitForSysbox(runtime: DockerRuntime, colima: string, docker: string, budgetMs: number): Promise<boolean> {
  const since = runtime.system.now();
  while (runtime.system.now() - since < budgetMs) {
    throwIfAborted(runtime, VM_MESSAGES.cancelled);
    if (await hasSysbox(runtime, colima, docker)) {
      runtime.log(VM_LOG_MESSAGES.sysboxReady);
      return true;
    }
    runtime.log(VM_LOG_MESSAGES.waitingSysbox(Math.round((runtime.system.now() - since) / 1000)));
    await runtime.system.sleep(SYSBOX_POLL_MS, runtime.signal);
  }
  throwIfAborted(runtime, VM_MESSAGES.cancelled);
  return false;
}

function failedRun(file: string, args: readonly string[], result: CommandResult, message: (detail: string) => string, commands?: string[]) {
  return blocked(message(commandError(file, args, result)), commands);
}

async function stopInstance(runtime: DockerRuntime, colima: string, args: readonly string[]): Promise<DockerPhase | null> {
  const stop = await streamLogged(runtime, colima, args, VM_STOP_TIMEOUT_MS);
  throwIfAborted(runtime, VM_MESSAGES.cancelled);
  return stop.code === 0 ? null : failedRun("colima", args, stop, VM_MESSAGES.stopFailed);
}

async function provisionSysbox(runtime: DockerRuntime, colima: string): Promise<CommandResult> {
  const args = [...COLIMA_SSH, "sudo", "sh", "-s"];
  runtime.log(LOG_MESSAGES.run(`${describeCommand(colima, args)} < provision script`));
  const result = await runtime.system.run(colima, args, {
    env: runtime.env,
    signal: runtime.signal,
    timeoutMs: SYSBOX_PROVISION_TIMEOUT_MS,
    input: sysboxProvisionScript(),
  });
  for (const line of `${result.stdout}\n${result.stderr}`.split("\n")) if (line.trim()) runtime.log(line);
  runtime.log(LOG_MESSAGES.exit(result.code));
  return result;
}

async function ensureSysbox(runtime: DockerRuntime, colima: string, docker: string): Promise<DockerPhase> {
  if (await waitForSysbox(runtime, colima, docker, SYSBOX_SETTLE_MS)) return { kind: "ready" };
  runtime.log(VM_LOG_MESSAGES.reprovisioning);
  const result = await provisionSysbox(runtime, colima);
  throwIfAborted(runtime, VM_MESSAGES.cancelled);
  const commands = [VM_COMMANDS.sysboxStatus, VM_COMMANDS.provisionLog];
  if (result.code !== 0) {
    const guestOutput = { ...result, stderr: result.stderr.split("\n").filter((line) => !COLIMA_LOG_LINE.test(line)).join("\n") };
    return failedRun("colima", ["ssh"], guestOutput, VM_MESSAGES.provisionFailed, commands);
  }
  if (!(await waitForSysbox(runtime, colima, docker, SYSBOX_WAIT_MS))) {
    return blocked(VM_MESSAGES.sysboxTimeout(Math.round(SYSBOX_WAIT_MS / 1000)), commands);
  }
  return { kind: "ready" };
}

async function ensureContext(runtime: DockerRuntime, docker: string): Promise<CommandResult | null> {
  if ((await runQuiet(runtime, docker, ["context", "inspect", VM_CONTEXT])).code === 0) return null;
  runtime.log(VM_LOG_MESSAGES.contextMissing(VM_CONTEXT));
  const socket = posix.join(colimaHome(runtime.env, runtime.host.home), VM_PROFILE, COLIMA_SOCKET_FILE);
  const created = await runLogged(runtime, docker, ["context", "create", VM_CONTEXT, "--docker", `host=unix://${socket}`]);
  return created.code === 0 ? null : created;
}

async function bootVm(runtime: DockerRuntime, colima: string, docker: string): Promise<DockerPhase> {
  if (await dockerDesktopRunning(runtime)) runtime.log(VM_LOG_MESSAGES.dockerDesktopRunning);
  const instance = await readInstance(runtime, colima);
  if (instance?.status === COLIMA_STATUS.broken) {
    runtime.log(VM_LOG_MESSAGES.broken);
    const failed = await stopInstance(runtime, colima, ["stop", "-f", VM_PROFILE]);
    if (failed) return failed;
  } else if (instance?.status === COLIMA_STATUS.running) {
    const created = await ensureContext(runtime, docker);
    if (created) return failedRun("docker", ["context", "create", VM_CONTEXT], created, VM_MESSAGES.contextFailed);
    if (!(await hasSysboxRuntime(runtime, docker))) {
      runtime.log(VM_LOG_MESSAGES.restarting);
      const failed = await stopInstance(runtime, colima, ["stop", VM_PROFILE]);
      if (failed) return failed;
    }
  }
  runtime.phase({ kind: "starting", since: runtime.system.now() });
  const startArgs = ["start", VM_PROFILE];
  const start = await streamLogged(runtime, colima, startArgs, VM_START_TIMEOUT_MS);
  throwIfAborted(runtime, VM_MESSAGES.cancelled);
  if (start.code !== 0) return failedRun("colima", startArgs, start, VM_MESSAGES.startFailed, [VM_COMMANDS.start]);
  const created = await ensureContext(runtime, docker);
  if (created) return failedRun("docker", ["context", "create", VM_CONTEXT], created, VM_MESSAGES.contextFailed);
  const contextArgs = ["context", "use", VM_CONTEXT];
  const context = await runLogged(runtime, docker, contextArgs);
  if (context.code !== 0) return failedRun("docker", contextArgs, context, VM_MESSAGES.contextFailed);
  return ensureSysbox(runtime, colima, docker);
}

export async function setupWithRuntime(runtime: DockerRuntime, request: VmSetupRequest): Promise<DockerPhase> {
  if (runtime.host.platform !== "darwin") return blocked(VM_MESSAGES.unsupported);
  const brew = prepareEnv(runtime);
  if (!brew) {
    runtime.log(VM_LOG_MESSAGES.brewMissing);
    runtime.log(BREW_INSTALL_COMMAND);
    return blocked(VM_MESSAGES.noBrew, [BREW_INSTALL_COMMAND]);
  }
  const tools = await installTools(runtime, brew);
  if ("kind" in tools) return tools;
  await ensurePluginsDir(runtime, brew);
  await writeColimaConfig(runtime, request);
  return bootVm(runtime, tools.colima as string, tools.docker as string);
}

export async function startWithRuntime(runtime: DockerRuntime): Promise<DockerPhase> {
  if (runtime.host.platform !== "darwin") return blocked(VM_MESSAGES.unsupported);
  const tools = readTools(runtime, prepareEnv(runtime));
  if (!tools.colima || !tools.docker) return blocked(VM_MESSAGES.noColima);
  return bootVm(runtime, tools.colima, tools.docker);
}

export async function stopWithRuntime(runtime: DockerRuntime): Promise<DockerPhase> {
  if (runtime.host.platform !== "darwin") return blocked(VM_MESSAGES.unsupported);
  const tools = readTools(runtime, prepareEnv(runtime));
  if (!tools.colima) return blocked(VM_MESSAGES.noColima);
  const args = ["stop", VM_PROFILE];
  const result = await streamLogged(runtime, tools.colima, args, VM_STOP_TIMEOUT_MS);
  throwIfAborted(runtime, VM_MESSAGES.cancelled);
  return result.code === 0 ? { kind: "idle" } : failedRun("colima", args, result, VM_MESSAGES.stopFailed);
}

export async function guarded(runtime: DockerRuntime, run: () => Promise<DockerPhase>): Promise<DockerPhase> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof IpcError) throw error;
    if (isCancelled(error) || runtime.signal?.aborted) throw new IpcError("cancelled", VM_MESSAGES.cancelled);
    const message = error instanceof Error ? error.message : String(error);
    runtime.log(message);
    return blocked(message);
  }
}

export function vmRuntime(options: VmOptions = {}): DockerRuntime {
  return createRuntime(options);
}
