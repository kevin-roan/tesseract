import type { BuildPhase } from "../../shared/contracts/sandbox";
import { scrubEnv } from "../process";
import { DOCKER_TIMEOUT_MS, HEALTH_POLL_MS, HEALTH_TIMEOUT_MS, SCRUBBED_ENV_NAMES, SCRUBBED_ENV_PREFIXES } from "./constants";
import { findExisting, startExisting } from "./compose";
import { SANDBOX_LABELS } from "./labels";
import { saveConnection } from "./pairing";
import { sandboxDeps, type SandboxCallbacks, type SandboxContext, type SandboxDeps } from "./types";

export interface AdoptTarget {
  project: string;
  image: string;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function imageId(deps: SandboxDeps, env: NodeJS.ProcessEnv, image: string): Promise<string> {
  if (!image) return "";
  const result = await deps.run("docker", ["image", "inspect", "--format", "{{.Id}}", image], { timeoutMs: DOCKER_TIMEOUT_MS, env });
  return result.code === 0 ? result.stdout.trim() : "";
}

export async function adoptExisting(
  context: SandboxContext,
  target: AdoptTarget,
  callbacks: SandboxCallbacks,
  signal: AbortSignal,
): Promise<BuildPhase> {
  const deps = sandboxDeps(context);
  const env = scrubEnv(context.env, SCRUBBED_ENV_PREFIXES, SCRUBBED_ENV_NAMES);
  const phase = (next: BuildPhase): BuildPhase => {
    callbacks.onPhase?.(next);
    return next;
  };
  const cancelled = (): BuildPhase => {
    callbacks.onLog?.(SANDBOX_LABELS.adopt.cancelled);
    return phase({ kind: "cancelled" });
  };

  phase({ kind: "preflight" });
  const existing = await findExisting(context, target.project, target.image);
  const container = existing.container;
  if (!container) return phase({ kind: "failed", phase: "preflight", message: SANDBOX_LABELS.adopt.notFound(target.project) });
  if (signal.aborted) return cancelled();

  if (container.state !== "running") {
    if (!container.configFiles) return phase({ kind: "failed", phase: "up", message: SANDBOX_LABELS.adopt.noComposeFiles(container.name) });
    phase({ kind: "starting" });
    callbacks.onLog?.(SANDBOX_LABELS.adopt.starting(container.name));
    try {
      await startExisting(context, target.project, container, { onLog: (line) => callbacks.onLog?.(line) });
    } catch (error) {
      return phase({ kind: "failed", phase: "up", message: errorText(error) });
    }
  }
  if (signal.aborted) return cancelled();

  phase({ kind: "waiting", since: deps.now() });
  const deadline = deps.now() + HEALTH_TIMEOUT_MS;
  let lastError: string = SANDBOX_LABELS.pairing.unavailable;
  for (;;) {
    if (signal.aborted) return cancelled();
    const found = await deps.discover({ env: context.env, project: target.project, signal }).catch(
      (error: unknown) => ({ ok: false as const, error: errorText(error) }),
    );
    if (found.ok) {
      phase({ kind: "pairing" });
      callbacks.onLog?.(found.message);
      const { apiUrl, token, name, pairingUrl } = found.config;
      await saveConnection(context, { apiUrl, token, name, pairingUrl });
      return phase({ kind: "done", apiUrl, imageId: await imageId(deps, env, container.image) });
    }
    lastError = found.error;
    if (deps.now() >= deadline) return phase({ kind: "failed", phase: "pair", message: lastError });
    await deps.sleep(HEALTH_POLL_MS, signal);
  }
}
