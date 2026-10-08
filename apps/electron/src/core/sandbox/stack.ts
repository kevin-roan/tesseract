import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import type { ReachabilityMode } from "../../shared/contracts/sandbox";
import { IpcError } from "../../shared/ipc-types";
import { scrubEnv } from "../process";
import {
  COMPOSE_DIR,
  COMPOSE_FILES,
  DEFAULT_CONTROLLER_PORT,
  DEFAULT_PROJECT,
  DEFAULT_VNC_PORT,
  DOCKER_TIMEOUT_MS,
  LOCAL_BIND_ADDR,
  MODES,
  PATTERNS,
  SCRUBBED_ENV_NAMES,
  SCRUBBED_ENV_PREFIXES,
  SERVICE,
  STATE_SUBDIR,
  TAILSCALE_HOST_SOCKET_DIR,
  TAILSCALE_SOCKET,
  TAILSCALE_TIMEOUT_MS,
  WILDCARD_BIND_ADDRS,
} from "./constants";
import { isTruthyFlag, parseEnvFile, type EnvValues } from "./env-file";
import { SANDBOX_LABELS } from "./labels";
import { sandboxDeps, type SandboxContext, type SandboxDeps } from "./types";

export const SCRIPT_DEFAULT_MODE: ReachabilityMode = "tailscale";
const ADDRESS_COMMANDS = ["up", "config"];

export interface ResolvedStack {
  project: string;
  volumePrefix: string;
  controllerPort: number;
  vncPort: number;
  mode: ReachabilityMode;
  dind: boolean;
  tailscaleApi: boolean;
  bindAddr: string | null;
  socketDir: string | null;
  composeDir: string;
  envFile: string;
  values: EnvValues;
  files: string[];
  env: NodeJS.ProcessEnv;
  warnings: string[];
}

export class StackError extends IpcError {
  constructor(message: string) {
    super("invalid_argument", message);
    this.name = "StackError";
  }
}

const labels = SANDBOX_LABELS.stack;

export function isIpv4(value: string): boolean {
  if (!PATTERNS.ipv4.test(value)) return false;
  return value.split(".").every((octet) => (octet === "0" || !octet.startsWith("0")) && Number(octet) <= 255);
}

export function bindAddrError(addr: string): string | null {
  if ((WILDCARD_BIND_ADDRS as readonly string[]).includes(addr)) return labels.bindWildcard(addr);
  if (!isIpv4(addr) || addr.startsWith("0.")) return labels.bindInvalid(addr);
  return null;
}

function requirePort(key: string, value: string): number {
  if (!PATTERNS.port.test(value) || Number(value) > 65535) throw new StackError(labels.port(key, value));
  return Number(value);
}

export async function readEnvValues(envFile: string): Promise<EnvValues | null> {
  try {
    return parseEnvFile(await readFile(envFile, "utf8"));
  } catch {
    return null;
  }
}

export function composeDirOf(contextDir: string): string {
  return join(contextDir, ...COMPOSE_DIR);
}

export async function tailscaleIpv4(deps: Pick<SandboxDeps, "run">, env: NodeJS.ProcessEnv): Promise<string> {
  const result = await deps.run("tailscale", ["ip", "-4"], { timeoutMs: TAILSCALE_TIMEOUT_MS, env });
  if (result.code !== 0) return "";
  return result.stdout.split(/\r?\n/)[0]?.trim() ?? "";
}

export function claudeAccountsOverridePath(context: SandboxContext, deps: SandboxDeps, project: string): string {
  const file = `compose.${project}.claude-accounts.yml`;
  if (deps.platform !== "linux") return join(dirname(context.envFile), file);
  const stateHome = context.env.XDG_STATE_HOME;
  const base = stateHome && stateHome.startsWith("/") ? stateHome : join(context.env.HOME || deps.homeDir, ".local", "state");
  return join(base, STATE_SUBDIR, file);
}

export function yamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "$$$$")}"`;
}

export function claudeAccountsYaml(accounts: { name: string; path: string }[]): string {
  const lines = [
    "services:",
    `  ${SERVICE}:`,
    "    environment:",
    `      TESSERACT_CLAUDE_ACCOUNTS: ${yamlString(accounts.map((account) => account.name).join(","))}`,
    "    volumes:",
  ];
  for (const account of accounts) {
    lines.push(
      "      - type: bind",
      `        source: ${yamlString(account.path)}`,
      `        target: ${yamlString(`/home/dev/.claude-${account.name}`)}`,
      "        bind:",
      "          create_host_path: false",
    );
  }
  return `${lines.join("\n")}\n`;
}

export function parseClaudeAccounts(raw: string, home: string): { name: string; path: string }[] {
  const seen = new Set<string>();
  const accounts: { name: string; path: string }[] = [];
  for (const entry of raw.replace(/,/g, " ").split(/\s+/).filter(Boolean)) {
    const separator = entry.indexOf("=");
    const name = separator === -1 ? entry : entry.slice(0, separator);
    const path = separator === -1 ? `${home}/.claude-${name}` : entry.slice(separator + 1);
    if (!PATTERNS.claudeAccount.test(name)) throw new StackError(labels.accountName(name));
    if (seen.has(name)) throw new StackError(labels.accountTwice(name));
    seen.add(name);
    if (!isAbsolute(path) || /[\x00-\x1f\x7f]/.test(path)) throw new StackError(labels.accountPath(name, path));
    accounts.push({ name, path });
  }
  return accounts;
}

async function writeClaudeAccounts(
  context: SandboxContext,
  deps: SandboxDeps,
  project: string,
  values: EnvValues,
  warnings: string[],
): Promise<string | null> {
  const home = context.env.HOME || deps.homeDir;
  const accounts = parseClaudeAccounts(values.TESSERACT_HOST_CLAUDE_ACCOUNTS ?? "", home).filter((account) => {
    const ok = existsSync(account.path) && statSync(account.path).isDirectory();
    if (!ok) warnings.push(labels.accountSkipped(account.name, account.path));
    return ok;
  });
  if (accounts.length === 0) return null;
  const override = claudeAccountsOverridePath(context, deps, project);
  await mkdir(dirname(override), { recursive: true });
  const temp = `${override}.${process.pid}.tmp`;
  await writeFile(temp, claudeAccountsYaml(accounts));
  await rename(temp, override);
  return override;
}

export async function resolveStack(context: SandboxContext, command: string): Promise<ResolvedStack> {
  const deps = sandboxDeps(context);
  const values = await readEnvValues(context.envFile);
  if (!values) throw new IpcError("not_found", labels.notConfigured);
  const project = values.TESSERACT_COMPOSE_PROJECT || DEFAULT_PROJECT;
  if (!PATTERNS.project.test(project)) throw new StackError(labels.project(project));
  const volumePrefix = values.TESSERACT_VOLUME_PREFIX || project;
  if (!PATTERNS.volumePrefix.test(volumePrefix)) throw new StackError(labels.volumePrefix(volumePrefix));
  const controllerPort = requirePort("TESSERACT_CONTROLLER_HOST_PORT", values.TESSERACT_CONTROLLER_HOST_PORT || String(DEFAULT_CONTROLLER_PORT));
  const vncPort = requirePort("TESSERACT_VNC_HOST_PORT", values.TESSERACT_VNC_HOST_PORT || String(DEFAULT_VNC_PORT));

  const rawMode = values.TESSERACT_MODE || SCRIPT_DEFAULT_MODE;
  const mode = MODES.find((candidate) => candidate === rawMode);
  if (!mode) throw new StackError(labels.unknownMode(rawMode));
  const dind = isTruthyFlag(values.TESSERACT_DIND);
  const tailscaleApi = isTruthyFlag(values.TESSERACT_TAILSCALE_LOCALAPI);
  const composeDir = composeDirOf(context.contextDir);
  const files = [join(composeDir, COMPOSE_FILES.base)];
  const exported: NodeJS.ProcessEnv = {
    TESSERACT_COMPOSE_PROJECT: project,
    TESSERACT_VOLUME_PREFIX: volumePrefix,
    TESSERACT_CONTROLLER_HOST_PORT: String(controllerPort),
    TESSERACT_VNC_HOST_PORT: String(vncPort),
  };
  const baseEnv = scrubEnv(context.env, SCRUBBED_ENV_PREFIXES, SCRUBBED_ENV_NAMES);

  let bindAddr: string | null = null;
  if (mode === "tailscale") files.push(join(composeDir, COMPOSE_FILES.tailscale));
  if (mode === "host-tailscale") {
    bindAddr = values.TESSERACT_BIND_ADDR || (await tailscaleIpv4(deps, baseEnv));
    if (!bindAddr) {
      if (ADDRESS_COMMANDS.includes(command)) throw new StackError(labels.noTailscaleIp);
      bindAddr = LOCAL_BIND_ADDR;
    }
    const error = bindAddrError(bindAddr);
    if (error) throw new StackError(error);
    files.push(join(composeDir, COMPOSE_FILES.local));
  }
  if (mode === "local") {
    bindAddr = LOCAL_BIND_ADDR;
    files.push(join(composeDir, COMPOSE_FILES.local));
  }
  if (bindAddr) exported.TESSERACT_BIND_ADDR = bindAddr;
  if (dind) files.push(join(composeDir, COMPOSE_FILES.dind));

  let socketDir: string | null = null;
  if (tailscaleApi) {
    if (mode === "tailscale") files.push(join(composeDir, COMPOSE_FILES.tailscaleApiSidecar));
    else {
      socketDir = values.TESSERACT_TAILSCALE_HOST_SOCKET_DIR || TAILSCALE_HOST_SOCKET_DIR;
      if (!socketDir.startsWith("/")) throw new StackError(labels.socketDir(socketDir));
      exported.TESSERACT_TAILSCALE_HOST_SOCKET_DIR = socketDir;
      files.push(join(composeDir, COMPOSE_FILES.tailscaleApi));
    }
  }

  const warnings: string[] = [];
  const override = await writeClaudeAccounts(context, deps, project, values, warnings);
  if (override) files.push(override);

  return {
    project,
    volumePrefix,
    controllerPort,
    vncPort,
    mode,
    dind,
    tailscaleApi,
    bindAddr,
    socketDir,
    composeDir,
    envFile: context.envFile,
    values,
    files,
    env: { ...baseEnv, ...exported },
    warnings,
  };
}

export function composeArgs(stack: ResolvedStack, args: readonly string[]): string[] {
  return [
    "compose",
    "--project-name",
    stack.project,
    "--project-directory",
    stack.composeDir,
    "--env-file",
    stack.envFile,
    ...stack.files.flatMap((file) => ["-f", file]),
    ...args,
  ];
}

export async function checkUpPreconditions(stack: ResolvedStack, deps: SandboxDeps): Promise<void> {
  if (stack.mode === "tailscale") {
    if (!stack.values.TS_TAILNET_DOMAIN) throw new StackError(labels.tailnetDomain);
    if (!stack.values.TS_AUTHKEY && !(await tailscaleVolumeExists(deps, stack.env, stack.volumePrefix))) {
      throw new StackError(labels.authKey);
    }
  }
  if (stack.tailscaleApi && stack.mode !== "tailscale" && stack.socketDir) {
    if (!existsSync(join(stack.socketDir, TAILSCALE_SOCKET))) throw new StackError(labels.noSocket(stack.socketDir));
  }
}

export async function tailscaleVolumeExists(
  deps: Pick<SandboxDeps, "run">,
  env: NodeJS.ProcessEnv,
  volumePrefix: string,
): Promise<boolean> {
  const result = await deps.run("docker", ["volume", "inspect", `${volumePrefix}-tailscale`], {
    timeoutMs: DOCKER_TIMEOUT_MS,
    env,
  });
  return result.code === 0;
}
