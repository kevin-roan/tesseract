import { restPaths } from "@tesseract/protocol";
import type { ProbeOutcome } from "../../shared/contracts/connection";
import { DISCOVERY, HEALTH_PATH } from "./constants";
import { VERIFY_MESSAGES } from "./labels";

export type HealthProber = (url: string, timeoutMs: number, signal?: AbortSignal) => Promise<boolean>;

export function isHealthyPayload(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const record = data as { ok?: unknown; protocolVersion?: unknown };
  return record.ok === true && record.protocolVersion === DISCOVERY.protocolVersion;
}

export async function probeHealth(
  url: string,
  timeoutMs: number = DISCOVERY.healthTimeoutMs,
  signal?: AbortSignal,
): Promise<boolean> {
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(`${url}${HEALTH_PATH}`, {
      headers: { Accept: "application/json" },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) return false;
    return isHealthyPayload(await response.json());
  } catch {
    return false;
  }
}

export async function pickReachable(
  candidates: readonly string[],
  prober: HealthProber = probeHealth,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<{ url: string | null; tried: [string, ProbeOutcome][] }> {
  const { timeoutMs = DISCOVERY.healthTimeoutMs, signal } = options;
  const controllers = candidates.map(() => new AbortController());
  const stopAll = () => controllers.forEach((controller) => controller.abort());
  signal?.addEventListener("abort", stopAll, { once: true });
  const probes = candidates.map((url, index) =>
    prober(url, timeoutMs, controllers[index]?.signal).catch(() => false),
  );
  const tried: [string, ProbeOutcome][] = [];
  try {
    for (const [index, url] of candidates.entries()) {
      const ok = await probes[index];
      tried.push([url, ok ? "ok" : "unreachable"]);
      if (ok) return { url, tried };
    }
    return { url: null, tried };
  } finally {
    stopAll();
    signal?.removeEventListener("abort", stopAll);
  }
}

export type VerifyResult = { ok: true } | { ok: false; error: string };

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function verifyConnection(
  apiUrl: string,
  token: string,
  options: { timeoutMs?: number; fetcher?: Fetcher } = {},
): Promise<VerifyResult> {
  const { timeoutMs = DISCOVERY.remoteTimeoutMs, fetcher = fetch } = options;
  const request = (path: string, headers: Record<string, string> = {}) =>
    fetcher(`${apiUrl}${path}`, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(timeoutMs) });
  try {
    const health = await request(restPaths.health());
    if (!health.ok) return { ok: false, error: VERIFY_MESSAGES.notTesseract(apiUrl) };
    if (!isHealthyPayload(await health.json().catch(() => null))) return { ok: false, error: VERIFY_MESSAGES.incompatible };
    const status = await request(restPaths.status(), { Authorization: `Bearer ${token}` });
    if (status.status === 401 || status.status === 403) return { ok: false, error: VERIFY_MESSAGES.unauthorized };
    if (!status.ok) return { ok: false, error: VERIFY_MESSAGES.failed(status.status) };
    return { ok: true };
  } catch {
    return { ok: false, error: VERIFY_MESSAGES.unreachable(apiUrl) };
  }
}
