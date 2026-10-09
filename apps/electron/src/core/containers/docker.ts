import type { CommandResult } from "../process";
import type { StreamOptions, StreamResult } from "../sandbox/spawn";
import type { ContainerState, ContainerTailnet, ServerContainer } from "../../shared/contracts/containers";
import { IpcError } from "../../shared/ipc-types";
import {
  CLOUDFLARED_IMAGE,
  CONTAINER_PREFIX,
  DOCKER_LABELS,
  IN_CONTAINER,
  LIMITS,
  ROLES,
  SERVER_IMAGE,
  SYSBOX_RUNTIME,
  TIMEOUTS,
} from "./constants";
import { CONTAINERS_MESSAGES } from "./labels";

export interface DockerDeps {
  run(file: string, args: readonly string[], options?: { timeoutMs?: number; input?: string; extraEnv?: Record<string, string> }): Promise<CommandResult>;
  stream(file: string, args: readonly string[], options?: StreamOptions): Promise<StreamResult>;
  log(line: string): void;
}

export interface CreateSpec {
  name: string;
  cpus: number | null;
  memoryMb: number | null;
  tailnet: { authKey: string; tags: string } | null;
}

interface PsRow {
  ID: string;
  Names: string;
  Image: string;
  State: string;
  Status: string;
  CreatedAt: string;
  Labels: string;
}

interface InspectRow {
  Id: string;
  HostConfig?: { NanoCpus?: number; Memory?: number };
}

export const serverName = (name: string) => `${CONTAINER_PREFIX}${name}`;
export const tunnelName = (name: string) => `${CONTAINER_PREFIX}${name}-tunnel`;
export const networkName = (name: string) => `${CONTAINER_PREFIX}${name}`;
export const dockerVolume = (name: string) => `${CONTAINER_PREFIX}${name}-docker`;

async function docker(deps: DockerDeps, args: readonly string[], options: { timeoutMs?: number; input?: string } = {}): Promise<string> {
  const result = await deps.run("docker", args, { timeoutMs: options.timeoutMs ?? TIMEOUTS.docker, input: options.input });
  if (result.code !== 0) {
    throw new IpcError("unavailable", CONTAINERS_MESSAGES.dockerFailed(args[0] ?? "", (result.stderr || result.stdout).trim().split("\n").at(-1) ?? ""));
  }
  return result.stdout;
}

async function succeeds(deps: DockerDeps, args: readonly string[], timeoutMs: number = TIMEOUTS.docker): Promise<boolean> {
  return (await deps.run("docker", args, { timeoutMs })).code === 0;
}

export function parseLabels(value: string): Record<string, string> {
  return Object.fromEntries(
    value
      .split(",")
      .map((pair) => pair.split("="))
      .filter((parts): parts is [string, ...string[]] => parts.length >= 2 && Boolean(parts[0]))
      .map(([key, ...rest]) => [key, rest.join("=")]),
  );
}

export function containerState(state: string, status: string): ContainerState {
  if (state === "running") return /health: starting/.test(status) ? "starting" : "running";
  if (state === "restarting" || state === "created") return "starting";
  if (state === "dead") return "error";
  return "stopped";
}

export function parseTailnet(name: string, json: string): ContainerTailnet | null {
  try {
    const status = JSON.parse(json) as { BackendState?: string; Self?: { HostName?: string; DNSName?: string; TailscaleIPs?: string[]; Online?: boolean } };
    if (!status.Self || status.BackendState === "NeedsLogin" || status.BackendState === "NoState") return null;
    const dnsName = status.Self.DNSName ? status.Self.DNSName.replace(/\.$/, "") : null;
    const hostname = status.Self.HostName || name;
    return {
      hostname,
      dnsName,
      ip: status.Self.TailscaleIPs?.find((ip) => ip.includes(".")) ?? status.Self.TailscaleIPs?.[0] ?? null,
      online: status.BackendState === "Running" && status.Self.Online !== false,
      sshTarget: `root@${dnsName ?? hostname}`,
    };
  } catch {
    return null;
  }
}

export async function hasSysbox(deps: DockerDeps): Promise<boolean> {
  const result = await deps.run("docker", ["info", "--format", "{{json .Runtimes}}"], { timeoutMs: TIMEOUTS.docker });
  return result.code === 0 && result.stdout.includes(`"${SYSBOX_RUNTIME}"`);
}

export async function imagePresent(deps: DockerDeps): Promise<boolean> {
  return succeeds(deps, ["image", "inspect", "--format", "{{.Id}}", SERVER_IMAGE]);
}

export async function buildServerImage(deps: DockerDeps, contextDir: string, signal?: AbortSignal, onStep?: (step: string) => void): Promise<void> {
  const onLine = (line: string) => {
    deps.log(line);
    const step = /^#\d+ \[[^\]]+\] (.+)$/.exec(line)?.[1];
    if (step) onStep?.(step);
  };
  const result = await deps.stream("docker", ["build", "--progress=plain", "-t", SERVER_IMAGE, contextDir], { signal, onStdout: onLine, onStderr: onLine });
  if (result.cancelled) throw new IpcError("cancelled", CONTAINERS_MESSAGES.cancelled);
  if (result.code !== 0) throw new IpcError("internal", CONTAINERS_MESSAGES.buildFailed, result.error ?? undefined);
}

async function tailnetOf(deps: DockerDeps, name: string): Promise<ContainerTailnet | null> {
  const result = await deps.run("docker", ["exec", serverName(name), "tailscale", "status", "--json", "--self=true", "--peers=false"], { timeoutMs: TIMEOUTS.exec });
  return result.code === 0 ? parseTailnet(name, result.stdout) : null;
}

export async function listContainers(deps: DockerDeps): Promise<ServerContainer[]> {
  const stdout = await docker(deps, ["ps", "-a", "--no-trunc", "--filter", `label=${DOCKER_LABELS.container}`, "--format", "{{json .}}"]);
  const rows = stdout
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as PsRow)
    .map((row) => ({ row, labels: parseLabels(row.Labels) }));
  const servers = rows.filter(({ labels }) => labels[DOCKER_LABELS.role] === ROLES.server);
  const tunnels = new Map(rows.filter(({ labels }) => labels[DOCKER_LABELS.role] === ROLES.tunnel).map(({ row, labels }) => [labels[DOCKER_LABELS.container], row.State]));
  const limits = servers.length ? (JSON.parse(await docker(deps, ["inspect", ...servers.map(({ row }) => row.ID)])) as InspectRow[]) : [];
  const result = await Promise.all(
    servers.map(async ({ row, labels }): Promise<ServerContainer> => {
      const name = labels[DOCKER_LABELS.container] as string;
      const host = limits.find((entry) => entry.Id === row.ID)?.HostConfig;
      const state = containerState(row.State, row.Status);
      const tunnel = tunnels.get(name);
      return {
        name,
        id: row.ID,
        state,
        status: row.Status,
        image: row.Image,
        createdAt: row.CreatedAt,
        cpus: host?.NanoCpus ? host.NanoCpus / 1e9 : null,
        memoryMb: host?.Memory ? Math.round(host.Memory / 1024 / 1024) : null,
        tailnet: state === "running" ? await tailnetOf(deps, name) : null,
        tunnel: tunnel === undefined ? "none" : tunnel === "running" ? "running" : "stopped",
      };
    }),
  );
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function findContainer(deps: DockerDeps, name: string): Promise<ServerContainer> {
  const found = (await listContainers(deps)).find((container) => container.name === name);
  if (!found) throw new IpcError("not_found", CONTAINERS_MESSAGES.notFound(name));
  return found;
}

function labelArgs(name: string, role: string): string[] {
  return ["--label", `${DOCKER_LABELS.container}=${name}`, "--label", `${DOCKER_LABELS.role}=${role}`];
}

export function createArgs(spec: CreateSpec): string[] {
  return [
    "create",
    "--name",
    serverName(spec.name),
    "--hostname",
    spec.name,
    "--runtime",
    SYSBOX_RUNTIME,
    "--network",
    networkName(spec.name),
    "--restart",
    "unless-stopped",
    "--mount",
    `type=volume,source=${dockerVolume(spec.name)},target=${IN_CONTAINER.dockerData}`,
    ...(spec.cpus ? ["--cpus", String(spec.cpus)] : []),
    ...(spec.memoryMb ? ["--memory", `${spec.memoryMb}m`] : []),
    ...labelArgs(spec.name, ROLES.server),
    SERVER_IMAGE,
  ];
}

async function waitForBoot(deps: DockerDeps, name: string): Promise<void> {
  await deps.run("docker", ["exec", serverName(name), "systemctl", "is-system-running", "--wait"], { timeoutMs: TIMEOUTS.docker * 4 });
}

export async function joinTailnet(deps: DockerDeps, name: string, tailnet: { authKey: string; tags: string }): Promise<void> {
  await waitForBoot(deps, name);
  const target = serverName(name);
  const write = (path: string, content: string) =>
    docker(deps, ["exec", "-i", target, "sh", "-c", `umask 077 && mkdir -p ${IN_CONTAINER.secretsDir} && cat > ${path}`], { input: content, timeoutMs: TIMEOUTS.exec });
  await write(IN_CONTAINER.authKey, tailnet.authKey);
  await write(IN_CONTAINER.tailnetEnv, `TESSERACT_TAILNET_HOSTNAME=${name}\nTESSERACT_TAILNET_TAGS=${tailnet.tags}\n`);
  await docker(deps, ["exec", target, "systemctl", "restart", "--no-block", "tesseract-tailnet.service"], { timeoutMs: TIMEOUTS.exec });
}

export async function createContainer(deps: DockerDeps, spec: CreateSpec): Promise<void> {
  if (await succeeds(deps, ["container", "inspect", serverName(spec.name)])) {
    throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.exists(spec.name));
  }
  try {
    if (!(await succeeds(deps, ["network", "inspect", networkName(spec.name)]))) {
      await docker(deps, ["network", "create", "--driver", "bridge", ...labelArgs(spec.name, ROLES.server), networkName(spec.name)]);
    }
    await docker(deps, ["volume", "create", ...labelArgs(spec.name, ROLES.server), dockerVolume(spec.name)]);
    await docker(deps, createArgs(spec));
    await docker(deps, ["start", serverName(spec.name)]);
  } catch (error) {
    await removeContainer(deps, spec.name);
    throw error;
  }
  if (!spec.tailnet) return;
  try {
    await joinTailnet(deps, spec.name, spec.tailnet);
  } catch (error) {
    deps.log(CONTAINERS_MESSAGES.tailnetFailed(spec.name, error instanceof Error ? error.message : String(error)));
  }
}

async function hasTunnel(deps: DockerDeps, name: string): Promise<boolean> {
  return succeeds(deps, ["container", "inspect", tunnelName(name)]);
}

export async function startContainer(deps: DockerDeps, name: string): Promise<void> {
  await docker(deps, ["start", serverName(name)]);
  if (await hasTunnel(deps, name)) await docker(deps, ["start", tunnelName(name)]);
}

export async function stopContainer(deps: DockerDeps, name: string): Promise<void> {
  if (await hasTunnel(deps, name)) await docker(deps, ["stop", tunnelName(name)]);
  await docker(deps, ["stop", "--time", "30", serverName(name)], { timeoutMs: TIMEOUTS.docker * 3 });
}

export async function restartContainer(deps: DockerDeps, name: string): Promise<void> {
  await docker(deps, ["restart", "--time", "30", serverName(name)], { timeoutMs: TIMEOUTS.docker * 3 });
}

export async function removeContainer(deps: DockerDeps, name: string): Promise<void> {
  await deps.run("docker", ["rm", "-f", tunnelName(name), serverName(name)], { timeoutMs: TIMEOUTS.docker * 3 });
  await deps.run("docker", ["network", "rm", networkName(name)], { timeoutMs: TIMEOUTS.docker });
  await deps.run("docker", ["volume", "rm", dockerVolume(name)], { timeoutMs: TIMEOUTS.docker });
}

export async function containerLogs(deps: DockerDeps, name: string): Promise<string[]> {
  const result = await deps.run("docker", ["logs", "--tail", String(LIMITS.logTail), serverName(name)], { timeoutMs: TIMEOUTS.docker });
  return `${result.stdout}${result.stderr}`.split("\n").filter(Boolean);
}

export function tunnelArgs(name: string): string[] {
  return [
    "run",
    "-d",
    "--name",
    tunnelName(name),
    "--network",
    networkName(name),
    "--restart",
    "unless-stopped",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--env",
    "TUNNEL_TOKEN",
    ...labelArgs(name, ROLES.tunnel),
    CLOUDFLARED_IMAGE,
    "tunnel",
    "--no-autoupdate",
    "run",
  ];
}

export async function ensureTunnel(deps: DockerDeps, name: string, token: string): Promise<void> {
  const state = await deps.run("docker", ["container", "inspect", "--format", "{{.State.Running}}", tunnelName(name)], { timeoutMs: TIMEOUTS.docker });
  if (state.code === 0 && state.stdout.trim() === "true") return;
  if (state.code === 0 && (await succeeds(deps, ["start", tunnelName(name)]))) return;
  await deps.run("docker", ["rm", "-f", tunnelName(name)], { timeoutMs: TIMEOUTS.docker });
  const result = await deps.run("docker", tunnelArgs(name), { timeoutMs: TIMEOUTS.docker * 4, extraEnv: { TUNNEL_TOKEN: token } });
  if (result.code !== 0) throw new IpcError("unavailable", CONTAINERS_MESSAGES.dockerFailed("run", result.stderr.trim()));
}

export async function removeTunnel(deps: DockerDeps, name: string): Promise<void> {
  await deps.run("docker", ["rm", "-f", tunnelName(name)], { timeoutMs: TIMEOUTS.docker });
}

export function serviceUrl(name: string, port: number, scheme: "http" | "https"): string {
  return `${scheme}://${serverName(name)}:${port}`;
}
