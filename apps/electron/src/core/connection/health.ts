import type { ProbeOutcome } from "../../shared/contracts/connection";
import { DISCOVERY, HEALTH_PATH } from "./constants";

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
