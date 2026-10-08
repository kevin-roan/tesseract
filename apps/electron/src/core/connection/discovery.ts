import { normalizeBaseUrl, parsePairingLink } from "@tesseract/protocol";
import type { ConnectionConfig, DiscoveryResult } from "../../shared/contracts/connection";
import type { ConfigData } from "../config";
import {
  DISCOVERY,
  DISCOVERY_ENV,
  LOOPBACK_HOST,
  PAIR_ARGS,
  PROJECT_NAME_PATTERN,
  SANDBOX_STACK_KEY,
  WILDCARD_BINDS,
} from "./constants";
import { containerRunner, DiscoveryError, type ContainerRunner } from "./container-cli";
import { pickReachable, probeHealth, type HealthProber } from "./health";
import { DISCOVERY_MESSAGES } from "./labels";

type Env = Record<string, string | undefined>;

export interface PairInfo {
  link: string;
  url: string;
  token: string;
  name: string | null;
}

export interface ContainerNetwork {
  published: [hostIp: string, hostPort: string][];
  addresses: string[];
  networkContainer: string | null;
}

export interface DiscoveryOptions {
  env: NodeJS.ProcessEnv;
  project?: string;
  signal?: AbortSignal;
  platform?: NodeJS.Platform;
  runner?: ContainerRunner;
  prober?: HealthProber;
}

const EMPTY_NETWORK: ContainerNetwork = { published: [], addresses: [], networkContainer: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function composeProject(env: Env): string {
  return env[DISCOVERY_ENV.project] || DISCOVERY.project;
}

export function containerName(project: string): string {
  return `${project}-${DISCOVERY.service}-1`;
}

export function sandboxContainer(env: Env): string {
  return containerName(composeProject(env));
}

export function stackProject(data: ConfigData): string | null {
  const stack = data[SANDBOX_STACK_KEY];
  if (!isRecord(stack) || typeof stack.project !== "string") return null;
  return PROJECT_NAME_PATTERN.test(stack.project) ? stack.project : null;
}

export function parsePairJson(output: string): PairInfo {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();
  for (const line of lines) {
    let data: unknown;
    try {
      data = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(data) || typeof data.link !== "string") continue;
    const parsed = parsePairingLink(data.link);
    if (!parsed.ok) throw new DiscoveryError(DISCOVERY_MESSAGES.invalidPairingLink(parsed.error.message));
    const url = typeof data.url === "string" ? normalizeBaseUrl(data.url) : null;
    const name = typeof data.name === "string" && data.name ? data.name : (parsed.value.name ?? null);
    return { link: data.link, url: url ?? parsed.value.url, token: parsed.value.token, name };
  }
  throw new DiscoveryError(DISCOVERY_MESSAGES.noPairingLink);
}

export function parseInspect(output: string, port: number = DISCOVERY.controllerPort): ContainerNetwork {
  let data: unknown;
  try {
    data = JSON.parse(output);
  } catch {
    throw new DiscoveryError(DISCOVERY_MESSAGES.invalidInspect);
  }
  const item = Array.isArray(data) ? data[0] : data;
  if (!isRecord(item)) return EMPTY_NETWORK;
  const settings = isRecord(item.NetworkSettings) ? item.NetworkSettings : {};
  const ports = isRecord(settings.Ports) ? settings.Ports : {};
  const bindings = ports[`${port}/tcp`];
  const published: ContainerNetwork["published"] = Array.isArray(bindings)
    ? bindings
        .filter((binding): binding is Record<string, unknown> => isRecord(binding) && Boolean(binding.HostPort))
        .map((binding) => [String(binding.HostIp ?? ""), String(binding.HostPort)])
    : [];
  const networks = isRecord(settings.Networks) ? Object.values(settings.Networks) : [];
  const addresses = networks
    .filter((network): network is Record<string, unknown> => isRecord(network) && Boolean(network.IPAddress))
    .map((network) => String(network.IPAddress));
  const hostConfig = isRecord(item.HostConfig) ? item.HostConfig : {};
  const mode = typeof hostConfig.NetworkMode === "string" ? hostConfig.NetworkMode : "";
  const networkContainer = mode.startsWith("container:") ? mode.slice("container:".length) : null;
  return { published, addresses, networkContainer };
}

export async function containerNetwork(container: string, runner: ContainerRunner): Promise<ContainerNetwork> {
  const network = parseInspect(await runner(["inspect", container], DISCOVERY.dockerTimeoutMs));
  if (!network.networkContainer) return network;
  const owner = parseInspect(await runner(["inspect", network.networkContainer], DISCOVERY.dockerTimeoutMs));
  return {
    published: [...network.published, ...owner.published],
    addresses: [...network.addresses, ...owner.addresses],
    networkContainer: network.networkContainer,
  };
}

function hostFor(bind: string): string {
  if (WILDCARD_BINDS.includes(bind)) return LOOPBACK_HOST;
  return bind.includes(":") && !bind.startsWith("[") ? `[${bind}]` : bind;
}

export function candidateApiUrls(pairingUrl: string | null, network: ContainerNetwork | null, env: Env): string[] {
  const hostPort = env[DISCOVERY_ENV.hostPort] || String(DISCOVERY.controllerPort);
  const bind = env[DISCOVERY_ENV.bindAddr];
  const candidates = [
    ...(network?.published.map(([ip, port]) => `http://${hostFor(ip)}:${port}`) ?? []),
    ...(bind ? [`http://${hostFor(bind)}:${hostPort}`] : []),
    `http://${LOOPBACK_HOST}:${hostPort}`,
    ...(network?.addresses.map((ip) => `http://${hostFor(ip)}:${DISCOVERY.controllerPort}`) ?? []),
    ...(pairingUrl ? [pairingUrl] : []),
  ];
  const ordered: string[] = [];
  for (const url of candidates) {
    const normalized = normalizeBaseUrl(url);
    if (normalized && !ordered.includes(normalized)) ordered.push(normalized);
  }
  return ordered;
}

export async function discoverDocker(options: DiscoveryOptions): Promise<DiscoveryResult> {
  const { env, signal } = options;
  const runner = options.runner ?? containerRunner({ env, platform: options.platform, signal });
  const container = containerName(options.project ?? composeProject(env));
  try {
    const pair = parsePairJson(await runner(["exec", "-u", DISCOVERY.execUser, container, DISCOVERY.binary, ...PAIR_ARGS], DISCOVERY.dockerTimeoutMs));
    const network = await containerNetwork(container, runner).catch(() => null);
    if (signal?.aborted) throw new DiscoveryError(DISCOVERY_MESSAGES.cancelled);
    const candidates = candidateApiUrls(pair.url, network, env);
    const { url, tried } = await pickReachable(candidates, options.prober ?? probeHealth, { signal });
    if (signal?.aborted) throw new DiscoveryError(DISCOVERY_MESSAGES.cancelled);
    const config: ConnectionConfig = {
      apiUrl: url ?? pair.url,
      token: pair.token,
      name: pair.name,
      pairingUrl: pair.url,
      source: "docker",
      container,
    };
    const label = pair.name || container;
    const message = url ? DISCOVERY_MESSAGES.found(label, config.apiUrl) : DISCOVERY_MESSAGES.unreachable(label);
    return { ok: true, config, message, tried };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

export interface StartupDiscoveryOptions extends DiscoveryOptions {
  timeoutMs?: number;
  discover?: (options: DiscoveryOptions) => Promise<DiscoveryResult>;
}

export function discoveryDisabled(env: Env): boolean {
  return env[DISCOVERY_ENV.disabled] === "1";
}

export async function discoverHealthySandbox(options: StartupDiscoveryOptions): Promise<ConnectionConfig | null> {
  if (discoveryDisabled(options.env)) return null;
  const { timeoutMs = DISCOVERY.startupTimeoutMs, discover = discoverDocker, ...rest } = options;
  const controller = new AbortController();
  const stop = () => controller.abort();
  options.signal?.addEventListener("abort", stop, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      stop();
      resolve(null);
    }, timeoutMs);
  });
  const found = discover({ ...rest, signal: controller.signal })
    .then((result) => (result.ok && result.tried.some(([, outcome]) => outcome === "ok") ? result.config : null))
    .catch(() => null);
  try {
    return await Promise.race([found, timeout]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", stop);
  }
}
