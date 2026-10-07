import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { ComposeServiceStatus, ExistingSandbox, SandboxStackStatus } from "../../shared/contracts/sandbox";
import { IpcError } from "../../shared/ipc-types";
import { commandError, scrubEnv, type CommandResult } from "../process";
import { containerName } from "../connection";
import {
  DEFAULT_LOG_TAIL,
  DEFAULT_PROJECT,
  DOCKER_TIMEOUT_MS,
  LABELS,
  SCRUBBED_ENV_NAMES,
  SCRUBBED_ENV_PREFIXES,
  SERVICE,
} from "./constants";
import { parseEnvFile } from "./env-file";
import { SANDBOX_LABELS } from "./labels";
import { checkUpPreconditions, composeArgs, readEnvValues, resolveStack, type ResolvedStack } from "./stack";
import { sandboxDeps, type SandboxContext, type SandboxDeps } from "./types";
import { writeEnvAtomic } from "./write";

export interface ComposeCallbacks {
  onLog?(line: string): void;
}

const PS_FORMAT = `{{.Names}}\t{{.State}}\t{{.Status}}\t{{.Label "${LABELS.service}"}}`;

function baseEnv(context: SandboxContext): NodeJS.ProcessEnv {
  return scrubEnv(context.env, SCRUBBED_ENV_PREFIXES, SCRUBBED_ENV_NAMES);
}

function fail(name: string, args: readonly string[], result: CommandResult): never {
  if (result.code === null && /ENOENT/.test(result.stderr)) throw new IpcError("unavailable", SANDBOX_LABELS.docker.missing);
  throw new IpcError("unavailable", commandError(name, args, result));
}

export async function stackProject(context: SandboxContext): Promise<{ project: string; configured: boolean }> {
  const values = await readEnvValues(context.envFile);
  return { project: values?.THEONE_COMPOSE_PROJECT || DEFAULT_PROJECT, configured: values !== null };
}

export function healthFromStatus(status: string): string | null {
  const match = /\((healthy|unhealthy|health: starting)\)/.exec(status);
  if (!match) return null;
  return match[1] === "health: starting" ? "starting" : (match[1] as string);
}

export function parsePsLines(stdout: string): ComposeServiceStatus[] {
  return stdout
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const [container = "", state = "", status = "", service = ""] = line.split("\t");
      return { service: service || container, container, state, health: healthFromStatus(status) };
    })
    .sort((a, b) => a.service.localeCompare(b.service));
}

export async function projectStatus(
  deps: SandboxDeps,
  env: NodeJS.ProcessEnv,
  project: string,
  configured: boolean,
): Promise<SandboxStackStatus> {
  const args = ["ps", "--all", "--filter", `label=${LABELS.project}=${project}`, "--format", PS_FORMAT];
  const result = await deps.run("docker", args, { timeoutMs: DOCKER_TIMEOUT_MS, env });
  if (result.code !== 0) fail("docker", args, result);
  return { configured, project, services: parsePsLines(result.stdout) };
}

export async function composeStatus(context: SandboxContext): Promise<SandboxStackStatus> {
  const { project, configured } = await stackProject(context);
  return projectStatus(sandboxDeps(context), baseEnv(context), project, configured);
}

async function runCompose(
  context: SandboxContext,
  stack: ResolvedStack,
  args: string[],
  callbacks: ComposeCallbacks & { signal?: AbortSignal } = {},
): Promise<void> {
  const deps = sandboxDeps(context);
  const fullArgs = composeArgs(stack, args);
  const tail: string[] = [];
  const onLine = (line: string) => {
    if (!line.trim() || line === tail.at(-1)) return;
    tail.push(line);
    if (tail.length > 20) tail.shift();
    callbacks.onLog?.(line);
  };
  const result = await deps.stream("docker", fullArgs, {
    env: stack.env,
    signal: callbacks.signal,
    onStdout: onLine,
    onStderr: onLine,
  });
  if (result.cancelled) throw new IpcError("cancelled", SANDBOX_LABELS.build.cancelled);
  if (result.code !== 0) {
    const message = result.error && /ENOENT/.test(result.error) ? SANDBOX_LABELS.docker.missing : result.error;
    fail("docker", fullArgs, { code: result.code, stdout: "", stderr: message ?? tail.join("\n"), timedOut: false });
  }
}

export async function removeAuthKey(envFile: string): Promise<void> {
  const text = await readFile(envFile, "utf8").catch(() => null);
  if (text === null || !parseEnvFile(text).TS_AUTHKEY) return;
  const next = text
    .split("\n")
    .map((line) => (/^\s*(?:export\s+)?TS_AUTHKEY=/.test(line) ? "TS_AUTHKEY=" : line))
    .join("\n");
  await writeEnvAtomic(envFile, next);
}

export async function composeUp(
  context: SandboxContext,
  callbacks: ComposeCallbacks & { signal?: AbortSignal } = {},
): Promise<SandboxStackStatus> {
  const deps = sandboxDeps(context);
  const stack = await resolveStack(context, "up");
  stack.warnings.forEach((line) => callbacks.onLog?.(line));
  await checkUpPreconditions(stack, deps);
  await runCompose(context, stack, ["up", "--detach"], callbacks);
  if (stack.mode === "tailscale") await removeAuthKey(stack.envFile);
  return projectStatus(deps, stack.env, stack.project, true);
}

export async function composeDown(
  context: SandboxContext,
  removeVolumes: boolean,
  callbacks: ComposeCallbacks = {},
): Promise<SandboxStackStatus> {
  const stack = await resolveStack(context, "down");
  await runCompose(context, stack, ["down", "--remove-orphans", ...(removeVolumes ? ["--volumes"] : [])], callbacks);
  return projectStatus(sandboxDeps(context), stack.env, stack.project, true);
}

export async function composeRestart(
  context: SandboxContext,
  service: string | null = null,
  callbacks: ComposeCallbacks = {},
): Promise<SandboxStackStatus> {
  const stack = await resolveStack(context, "restart");
  await runCompose(context, stack, ["restart", ...(service ? [service] : [])], callbacks);
  return projectStatus(sandboxDeps(context), stack.env, stack.project, true);
}

function lines(result: CommandResult): string[] {
  return `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter((line) => line.length > 0);
}

export async function composeLogs(context: SandboxContext, tail: number = DEFAULT_LOG_TAIL): Promise<string[]> {
  const deps = sandboxDeps(context);
  const count = String(Math.max(1, Math.floor(tail)));
  const { project, configured } = await stackProject(context);
  if (configured) {
    const stack = await resolveStack(context, "logs");
    const args = composeArgs(stack, ["logs", "--no-color", `--tail=${count}`]);
    const result = await deps.run("docker", args, { timeoutMs: DOCKER_TIMEOUT_MS, env: stack.env });
    if (result.code !== 0) fail("docker", args, result);
    return lines(result);
  }
  return containerLogs(deps, baseEnv(context), containerName(project), Number(count));
}

export async function containerLogs(deps: SandboxDeps, env: NodeJS.ProcessEnv, container: string, tail: number): Promise<string[]> {
  const args = ["logs", "--tail", String(tail), container];
  const result = await deps.run("docker", args, { timeoutMs: DOCKER_TIMEOUT_MS, env });
  if (result.code !== 0) fail("docker", args, result);
  return lines(result);
}

interface InspectedContainer {
  Name?: string;
  State?: { Status?: string };
  Config?: { Image?: string; Labels?: Record<string, string> | null };
}

interface InspectedImage {
  Size?: number;
  Created?: string;
  Config?: { Labels?: Record<string, string> | null };
}

export function parseExistingContainer(name: string, inspected: InspectedContainer): NonNullable<ExistingSandbox["container"]> {
  const labels = inspected.Config?.Labels ?? {};
  const files = labels[LABELS.configFiles]?.split(",").filter(Boolean) ?? [];
  return {
    name,
    state: inspected.State?.Status === "running" ? "running" : "stopped",
    image: inspected.Config?.Image ?? "",
    configFiles: files.length > 0 && files.every((file) => existsSync(file)) ? files : null,
    workingDir: labels[LABELS.workingDir] || null,
  };
}

export function parseExistingImage(ref: string, inspected: InspectedImage): NonNullable<ExistingSandbox["image"]> {
  return {
    ref,
    sizeBytes: inspected.Size ?? 0,
    version: inspected.Config?.Labels?.[LABELS.imageVersion] ?? null,
    createdAt: inspected.Created ?? "",
  };
}

async function inspectJson<T>(deps: SandboxDeps, env: NodeJS.ProcessEnv, args: string[]): Promise<T | null> {
  const result = await deps.run("docker", args, { timeoutMs: DOCKER_TIMEOUT_MS, env });
  if (result.code !== 0) return null;
  try {
    const parsed: unknown = JSON.parse(result.stdout.trim());
    return (Array.isArray(parsed) ? parsed[0] : parsed) as T;
  } catch {
    return null;
  }
}

export async function findExisting(context: SandboxContext, project: string, image: string): Promise<ExistingSandbox> {
  const deps = sandboxDeps(context);
  const env = baseEnv(context);
  const args = [
    "ps",
    "--all",
    "--filter",
    `label=${LABELS.project}=${project}`,
    "--filter",
    `label=${LABELS.service}=${SERVICE}`,
    "--format",
    "{{.Names}}",
  ];
  const listed = await deps.run("docker", args, { timeoutMs: DOCKER_TIMEOUT_MS, env });
  const name = listed.code === 0 ? listed.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) : undefined;
  const inspected = name ? await inspectJson<InspectedContainer>(deps, env, ["inspect", name]) : null;
  const imageInfo = await inspectJson<InspectedImage>(deps, env, ["image", "inspect", image, "--format", "{{json .}}"]);
  return {
    container: name && inspected ? parseExistingContainer(name, inspected) : null,
    image: imageInfo ? parseExistingImage(image, imageInfo) : null,
  };
}

export async function startExisting(
  context: SandboxContext,
  project: string,
  container: NonNullable<ExistingSandbox["container"]>,
  callbacks: ComposeCallbacks = {},
): Promise<SandboxStackStatus> {
  if (!container.configFiles || !container.workingDir) throw new IpcError("not_found", SANDBOX_LABELS.stack.notConfigured);
  const deps = sandboxDeps(context);
  const env = baseEnv(context);
  const args = [
    "compose",
    "--project-name",
    project,
    "--project-directory",
    container.workingDir,
    ...container.configFiles.flatMap((file) => ["-f", file]),
    "up",
    "--detach",
  ];
  const result = await deps.stream("docker", args, {
    env,
    onStdout: (line) => callbacks.onLog?.(line),
    onStderr: (line) => callbacks.onLog?.(line),
  });
  if (result.code !== 0) throw new IpcError("unavailable", result.error ?? SANDBOX_LABELS.build.failed(result.code));
  return projectStatus(deps, env, project, true);
}
