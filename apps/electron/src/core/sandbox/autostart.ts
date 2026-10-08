import type { SandboxStackStatus } from "../../shared/contracts/sandbox";
import { readConfig } from "../config";
import { scrubEnv } from "../process";
import { projectStatus, composeUp, type ComposeCallbacks } from "./compose";
import { DEFAULT_PROJECT, SCRUBBED_ENV_NAMES, SCRUBBED_ENV_PREFIXES, SERVICE } from "./constants";
import { SANDBOX_LABELS } from "./labels";
import { sandboxConfigFile, sandboxStackFromConfig } from "./settings";
import { readEnvValues } from "./stack";
import { sandboxDeps, type SandboxContext } from "./types";

export type AutostartSkipReason = "disabled" | "not-managed" | "docker-unreachable" | "running";

export type AutostartPlan =
  | { kind: "start"; project: string }
  | { kind: "skip"; reason: AutostartSkipReason; detail?: string };

export type AutostartOutcome =
  | AutostartPlan
  | { kind: "started"; project: string; status: SandboxStackStatus }
  | { kind: "failed"; project: string; message: string };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function planAutostart(context: SandboxContext, enabled: boolean): Promise<AutostartPlan> {
  if (!enabled) return { kind: "skip", reason: "disabled" };
  const stack = sandboxStackFromConfig(await readConfig(sandboxConfigFile(context)).catch(() => ({})));
  if (!stack || !stack.builtAt || stack.envFile !== context.envFile) return { kind: "skip", reason: "not-managed" };
  const values = await readEnvValues(context.envFile);
  const project = values?.TESSERACT_COMPOSE_PROJECT || DEFAULT_PROJECT;
  if (!values || project !== stack.project) return { kind: "skip", reason: "not-managed" };

  const deps = sandboxDeps(context);
  const report = await deps.probeDocker().catch(() => null);
  if (!report?.cli || report.daemon !== "reachable") {
    return { kind: "skip", reason: "docker-unreachable", detail: report?.daemonError ?? undefined };
  }
  const env = scrubEnv(context.env, SCRUBBED_ENV_PREFIXES, SCRUBBED_ENV_NAMES);
  const status = await projectStatus(deps, env, project, true);
  const sandbox = status.services.find((service) => service.service === SERVICE);
  if (sandbox?.state === "running") return { kind: "skip", reason: "running" };
  return { kind: "start", project };
}

export async function runAutostart(
  context: SandboxContext,
  enabled: boolean,
  callbacks: ComposeCallbacks = {},
): Promise<AutostartOutcome> {
  const plan = await planAutostart(context, enabled).catch(
    (error: unknown): AutostartPlan => ({ kind: "skip", reason: "docker-unreachable", detail: errorText(error) }),
  );
  if (plan.kind !== "start") return plan;
  callbacks.onLog?.(SANDBOX_LABELS.autostart.starting(plan.project));
  try {
    const status = await composeUp(context, callbacks);
    callbacks.onLog?.(SANDBOX_LABELS.autostart.started(plan.project));
    return { kind: "started", project: plan.project, status };
  } catch (error) {
    return { kind: "failed", project: plan.project, message: errorText(error) };
  }
}
