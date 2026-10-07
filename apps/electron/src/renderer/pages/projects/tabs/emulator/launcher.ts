import type { AppRun, HostAndroidStatus, RunTargetInfo, SandboxAndroidStatus } from "@theone/protocol";
import { BOOT_TIMEOUT_MS, POLL_MS, SESSION_REQUIRED_CODE, SESSION_REQUIRED_DETAIL, STOP_TIMEOUT_MS, TARGET_TIMEOUT_MS } from "./constants";
import { EMULATOR_LABELS } from "./labels";
import { androidTarget, emulatorReady, liveRun, type EmulatorPlan, type EmulatorStage } from "./model";

export interface HostAndroid {
  status(): Promise<HostAndroidStatus>;
  startEmulator(avd: string): Promise<unknown>;
  stopEmulator(): Promise<unknown>;
  linkSandbox(sandboxUrl: string, token: string): Promise<unknown>;
}

export interface SandboxApi {
  listRunTargets(projectId: string, options?: { signal?: AbortSignal }): Promise<RunTargetInfo[]>;
  listAppRuns(filter?: { projectId?: string }, options?: { signal?: AbortSignal }): Promise<AppRun[]>;
  startAppRun(projectId: string, body: { target: RunTargetInfo["target"] }, options?: { signal?: AbortSignal }): Promise<AppRun>;
  getAndroidStatus(options?: { signal?: AbortSignal }): Promise<SandboxAndroidStatus>;
}

export interface SandboxTarget {
  url: string;
  token: string;
}

export interface EmulatorRun {
  run: AppRun;
  started: boolean;
  serial: string | null;
}

export interface Timing {
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
  now(): number;
}

export class HostRequestError extends Error {
  constructor(
    message: string,
    readonly auth: boolean,
  ) {
    super(message);
    this.name = "HostRequestError";
  }
}

export class EmulatorTimeout extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmulatorTimeout";
  }
}

export function isAuthError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; detail?: unknown };
  return candidate.code === SESSION_REQUIRED_CODE && candidate.detail === SESSION_REQUIRED_DETAIL;
}

export function hostAndroid(host: HostAndroid): HostAndroid {
  const wrap =
    <A extends unknown[], R>(call: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await call(...args);
      } catch (error) {
        throw new HostRequestError(error instanceof Error ? error.message : String(error), isAuthError(error));
      }
    };
  return {
    status: wrap(() => host.status()),
    startEmulator: wrap((avd: string) => host.startEmulator(avd)),
    stopEmulator: wrap(() => host.stopEmulator()),
    linkSandbox: wrap((url: string, token: string) => host.linkSandbox(url, token)),
  };
}

export const realTiming: Timing = {
  now: () => Date.now(),
  sleep: (ms, signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve();
      }, ms);
      const abort = () => {
        clearTimeout(timer);
        reject(signal?.reason);
      };
      signal?.addEventListener("abort", abort, { once: true });
    }),
};

export async function waitFor(check: () => Promise<boolean>, timeoutMs: number, message: string, timing: Timing, signal?: AbortSignal) {
  const deadline = timing.now() + timeoutMs;
  while (!(await check())) {
    signal?.throwIfAborted();
    if (timing.now() >= deadline) throw new EmulatorTimeout(message);
    await timing.sleep(POLL_MS, signal);
  }
}

function settled(host: HostAndroid, done: (status: HostAndroidStatus) => boolean): () => Promise<boolean> {
  return async () => {
    const status = await host.status();
    if (status.emulator.state === "failed" && !done(status)) {
      throw new Error(EMULATOR_LABELS.emulatorFailed(status.emulator.error || EMULATOR_LABELS.unknownError));
    }
    return done(status);
  };
}

export interface PrepareOptions {
  host: HostAndroid;
  client: SandboxApi;
  sandbox: SandboxTarget;
  projectId: string;
  target: RunTargetInfo["target"];
  plan: EmulatorPlan;
  onStage(stage: EmulatorStage): void;
  timing?: Timing;
  signal?: AbortSignal;
}

export async function prepareEmulator({ host, client, sandbox, projectId, target, plan, onStage, timing = realTiming, signal }: PrepareOptions) {
  if (plan.stop) {
    onStage("stopping");
    await host.stopEmulator();
    await waitFor(
      async () => ["stopped", "failed"].includes((await host.status()).emulator.state),
      STOP_TIMEOUT_MS,
      EMULATOR_LABELS.stopTimeout,
      timing,
      signal,
    );
  }
  if (plan.avd) {
    onStage("starting");
    await host.startEmulator(plan.avd);
  }
  if (plan.link) {
    onStage("linking");
    await host.linkSandbox(sandbox.url, sandbox.token);
  }
  onStage("booting");
  await waitFor(
    settled(host, (status) => emulatorReady(status, sandbox.url)),
    BOOT_TIMEOUT_MS,
    EMULATOR_LABELS.bootTimeout(Math.round(BOOT_TIMEOUT_MS / 60_000)),
    timing,
    signal,
  );
  await waitFor(
    async () => {
      const targets = await client.listRunTargets(projectId, { signal });
      const found = androidTarget(targets.filter((item) => item.target === target));
      return found !== null && found.available;
    },
    TARGET_TIMEOUT_MS,
    EMULATOR_LABELS.targetTimeout(Math.round(TARGET_TIMEOUT_MS / 1000)),
    timing,
    signal,
  );
}

export async function runOnEmulator(client: SandboxApi, projectId: string, target: RunTargetInfo["target"], signal?: AbortSignal): Promise<EmulatorRun> {
  const existing = liveRun(await client.listAppRuns({ projectId }, { signal }), target);
  const run = existing ?? (await client.startAppRun(projectId, { target }, { signal }));
  const android = await client.getAndroidStatus({ signal });
  return { run, started: existing === null, serial: android.emulator?.serial ?? null };
}
