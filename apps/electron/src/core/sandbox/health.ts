import { containerName } from "../connection";
import { scrubEnv } from "../process";
import {
  DOCKER_TIMEOUT_MS,
  FAILURE_LOG_TAIL,
  HEALTH_POLL_MS,
  HEALTH_PROBE_TIMEOUT_MS,
  HEALTH_TIMEOUT_MS,
  LOCAL_BIND_ADDR,
  PROTOCOL_VERSION,
  SCRUBBED_ENV_NAMES,
  SCRUBBED_ENV_PREFIXES,
  DEFAULT_CONTROLLER_PORT,
  DEFAULT_HOSTNAME,
  DEFAULT_PROJECT,
} from "./constants";
import type { EnvValues } from "./env-file";
import { SANDBOX_LABELS } from "./labels";
import type { SandboxDeps } from "./types";

export type HealthResult =
  | { kind: "healthy"; url: string | null }
  | { kind: "failed"; message: string; logs: string[] }
  | { kind: "cancelled" };

export interface StackEndpoint {
  project: string;
  container: string;
  candidates: string[];
  pairingUrl: string | null;
  hostname: string;
  env: NodeJS.ProcessEnv;
}

export function stackEndpoint(values: EnvValues, env: NodeJS.ProcessEnv): StackEndpoint {
  const project = values.TESSERACT_COMPOSE_PROJECT || DEFAULT_PROJECT;
  const port = values.TESSERACT_CONTROLLER_HOST_PORT || String(DEFAULT_CONTROLLER_PORT);
  const hostname = values.TESSERACT_HOSTNAME || DEFAULT_HOSTNAME;
  const mode = values.TESSERACT_MODE;
  const tailnet = mode === "tailscale" && values.TS_TAILNET_DOMAIN ? `https://${hostname}.${values.TS_TAILNET_DOMAIN}` : null;
  const bind = mode === "host-tailscale" && values.TESSERACT_BIND_ADDR ? values.TESSERACT_BIND_ADDR : LOCAL_BIND_ADDR;
  const candidates = mode === "tailscale" ? (tailnet ? [tailnet] : []) : [`http://${bind}:${port}`];
  const exported: NodeJS.ProcessEnv = { TESSERACT_COMPOSE_PROJECT: project, TESSERACT_CONTROLLER_HOST_PORT: port };
  if (mode !== "tailscale") exported.TESSERACT_BIND_ADDR = bind;
  return {
    project,
    container: containerName(project),
    candidates,
    pairingUrl: tailnet,
    hostname,
    env: { ...scrubEnv(env, SCRUBBED_ENV_PREFIXES, SCRUBBED_ENV_NAMES), ...exported },
  };
}

export async function probeHealthUrl(deps: Pick<SandboxDeps, "fetch">, url: string, signal?: AbortSignal): Promise<boolean> {
  const timeout = AbortSignal.timeout(HEALTH_PROBE_TIMEOUT_MS);
  try {
    const response = await deps.fetch(`${url.replace(/\/+$/, "")}/v1/health`, {
      headers: { Accept: "application/json" },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { ok?: unknown; protocolVersion?: unknown };
    return body.ok === true && body.protocolVersion === PROTOCOL_VERSION;
  } catch {
    return false;
  }
}

interface ContainerState {
  Status?: string;
  ExitCode?: number;
  Health?: { Status?: string };
}

export async function containerState(deps: SandboxDeps, env: NodeJS.ProcessEnv, container: string): Promise<ContainerState | null> {
  const result = await deps.run("docker", ["inspect", "--format", "{{json .State}}", container], {
    timeoutMs: DOCKER_TIMEOUT_MS,
    env,
  });
  if (result.code !== 0) return null;
  try {
    return JSON.parse(result.stdout.trim()) as ContainerState;
  } catch {
    return null;
  }
}

async function tailLogs(deps: SandboxDeps, env: NodeJS.ProcessEnv, container: string): Promise<string[]> {
  const result = await deps.run("docker", ["logs", "--tail", String(FAILURE_LOG_TAIL), container], {
    timeoutMs: DOCKER_TIMEOUT_MS,
    env,
  });
  return `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter((line) => line.length > 0);
}

export async function firstHealthy(deps: Pick<SandboxDeps, "fetch">, urls: readonly string[], signal?: AbortSignal): Promise<string | null> {
  const results = await Promise.all(urls.map((url) => probeHealthUrl(deps, url, signal)));
  return urls[results.indexOf(true)] ?? null;
}

export async function waitHealthy(
  deps: SandboxDeps,
  endpoint: StackEndpoint,
  signal: AbortSignal,
  timeoutMs = HEALTH_TIMEOUT_MS,
): Promise<HealthResult> {
  const deadline = deps.now() + timeoutMs;
  for (;;) {
    if (signal.aborted) return { kind: "cancelled" };
    const state = await containerState(deps, endpoint.env, endpoint.container);
    if (state?.Status === "exited" || state?.Status === "dead") {
      const status = state.Status === "exited" ? `exited (${state.ExitCode ?? "?"})` : "is dead";
      return {
        kind: "failed",
        message: SANDBOX_LABELS.build.containerExited(status),
        logs: await tailLogs(deps, endpoint.env, endpoint.container),
      };
    }
    const url = await firstHealthy(deps, endpoint.candidates, signal);
    if (url) return { kind: "healthy", url };
    if (state?.Health?.Status === "healthy") return { kind: "healthy", url: null };
    if (deps.now() >= deadline) return { kind: "failed", message: SANDBOX_LABELS.build.healthTimeout, logs: [] };
    await deps.sleep(HEALTH_POLL_MS, signal);
  }
}
