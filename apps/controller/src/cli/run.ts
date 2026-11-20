import { parseArgs } from "node:util";
import { FINAL_APP_RUN_STATES, RUN_TARGETS, restPaths, type AppRun, type RunTargetInfo } from "@tesseract/protocol";
import type { Config } from "../config";
import { callLocalApi, CliError } from "./local-api";
import type { Output } from "./output";
import { projectFromCwd } from "./tesseract";

export const RUN_USAGE = `tesseract-controller run targets [--project <id>] [--json]
  tesseract-controller run <target> [--project <id>] [--port <n>] [--no-wait] [--json]
  tesseract-controller run list [--project <id>] [--json]
  tesseract-controller run stop <app_…>
                                     run the project's app on a device the app can show: the linked host iOS
                                     Simulator (expo-ios), the host Android emulator (expo-android, rn-android,
                                     flutter-android), the phone (expo-device) or the web/display targets; waits
                                     until it is ready (or failed), prints where it shows; <id> defaults to the
                                     project of the current folder`;

const DEFAULT_WAIT_MS = 10 * 60_000;
const POLL_MS = 2_000;
const FINAL: ReadonlySet<string> = new Set(FINAL_APP_RUN_STATES);
const isTarget = (value: string): value is AppRun["target"] => (RUN_TARGETS as readonly string[]).includes(value);

export type RunCliOptions = { cwd: string; signal?: AbortSignal; pollMs?: number; waitMs?: number };

function project(config: Config, flag: string | undefined, cwd: string): string {
  if (flag) return flag;
  try {
    return projectFromCwd(config, cwd);
  } catch {
    throw new CliError(`Pass --project <id> or run this inside a project folder under ${config.projectsDir}`, 2);
  }
}

/** One line per target: name, ready or why not, the label. */
export function formatTargets(projectId: string, targets: readonly RunTargetInfo[]): string {
  if (targets.length === 0) return `${projectId}: no run targets (not an app project Tesseract recognises)`;
  const width = Math.max(...targets.map((target) => target.target.length));
  const lines = targets.map((target) => `  ${target.target.padEnd(width)}  ${target.available ? "ready      " : "unavailable"}  ${target.label}${target.available ? "" : ` (${target.reason ?? "unavailable"})`}`);
  return [`Run targets for ${projectId}:`, ...lines].join("\n");
}

/** Where a run shows, for the agent to tell the user. */
export function formatRun(run: AppRun): string {
  const where =
    run.viewer === null
      ? ""
      : run.viewer.kind === "ios"
        ? " on the host iOS Simulator"
        : run.viewer.kind === "android"
          ? " on the host Android emulator"
          : run.viewer.kind === "url"
            ? ` at ${run.viewer.url ?? run.viewer.localUrl}`
            : run.viewer.kind === "deeplink"
              ? ` (Expo Go: ${run.viewer.expoGoUrl})`
                : run.viewer.kind === "display"
                ? " on the sandbox display"
                : "";
  const error = run.error ? `: ${run.error}` : "";
  return `${run.id} ${run.target} ${run.state}${where}${error}`;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

async function waitForRun(config: Config, run: AppRun, options: RunCliOptions): Promise<AppRun> {
  const deadline = Date.now() + (options.waitMs ?? DEFAULT_WAIT_MS);
  let current = run;
  while (current.state === "starting" && Date.now() < deadline && !options.signal?.aborted) {
    await sleep(options.pollMs ?? POLL_MS, options.signal);
    current = (await callLocalApi<AppRun>(config, "GET", restPaths.appRun(current.id))) ?? current;
  }
  return current;
}

export async function runCommand(config: Config, args: string[], output: Output, options: RunCliOptions): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      project: { type: "string" },
      port: { type: "string" },
      "no-wait": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });
  const [action, arg, ...extra] = positionals;
  if (!action || extra.length > 0) throw new CliError(`Usage:\n  ${RUN_USAGE}`, 2);
  const print = (value: unknown, text: string) => output.out(values.json ? JSON.stringify(value) : text);

  if (action === "targets") {
    const id = project(config, values.project, options.cwd);
    const targets = (await callLocalApi<RunTargetInfo[]>(config, "GET", restPaths.projectRunTargets(id))) ?? [];
    print(targets, formatTargets(id, targets));
    return 0;
  }
  if (action === "list") {
    const id = values.project ?? (arg ? undefined : safeProject(config, options.cwd));
    const runs = (await callLocalApi<AppRun[]>(config, "GET", restPaths.appRuns(id ? { projectId: id } : undefined))) ?? [];
    print(runs, runs.length === 0 ? "No app runs." : runs.map(formatRun).join("\n"));
    return 0;
  }
  if (action === "stop") {
    if (!arg) throw new CliError("run stop takes the run id (app_…; see tesseract-controller run list)", 2);
    await callLocalApi(config, "DELETE", restPaths.appRun(arg));
    output.out(`stopped ${arg}`);
    return 0;
  }
  if (!isTarget(action)) throw new CliError(`Unknown run target "${action}"; one of: ${RUN_TARGETS.join(", ")} (see tesseract-controller run targets)`, 2);
  if (arg) throw new CliError(`Usage:\n  ${RUN_USAGE}`, 2);
  const id = project(config, values.project, options.cwd);
  const port = values.port === undefined ? undefined : Number(values.port);
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new CliError(`--port must be a port number, got ${values.port}`, 2);
  const targets = (await callLocalApi<RunTargetInfo[]>(config, "GET", restPaths.projectRunTargets(id))) ?? [];
  const target = targets.find((item) => item.target === action);
  if (!target) throw new CliError(`${id} has no ${action} target. ${formatTargets(id, targets)}`);
  if (!target.available) throw new CliError(`${action} is not available for ${id}: ${target.reason ?? "unavailable"}`);
  const started = await callLocalApi<AppRun>(config, "POST", restPaths.projectAppRuns(id), { target: action, ...(port ? { port } : {}) });
  if (!started) throw new CliError("Empty response when starting the run");
  const run = values["no-wait"] ? started : await waitForRun(config, started, options);
  print(run, formatRun(run));
  return FINAL.has(run.state) ? 1 : 0;
}

function safeProject(config: Config, cwd: string): string | undefined {
  try {
    return projectFromCwd(config, cwd);
  } catch {
    return undefined;
  }
}
