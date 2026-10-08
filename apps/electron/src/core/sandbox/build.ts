import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  BuildFailurePhase,
  BuildMode,
  BuildPhase,
  SandboxStackConfig,
  SetupChoices,
} from "../../shared/contracts/sandbox";
import { IpcError } from "../../shared/ipc-types";
import { isDockerReady } from "../docker";
import { scrubEnv } from "../process";
import { BuildProgress, type BuildSnapshot } from "./buildkit";
import {
  choicesFromEnv,
  choicesToEnv,
  defaultChoices,
  validateChoices,
  type EnvSecrets,
  type HostResources,
  type ValidationContext,
} from "./choices";
import { composeUp } from "./compose";
import {
  BUILD_TARGET,
  COMPONENT_BUILD_ARGS,
  COMPONENTS,
  DEFAULT_CLAUDE_CODE_VERSION,
  DEFAULT_FLUTTER_VERSION,
  DEFAULT_IDS,
  DEFAULT_IMAGE,
  DEFAULT_PROJECT,
  DEFAULT_WHISPER_MODELS,
  DEFAULT_TIME_ZONE,
  DOCKER_TIMEOUT_MS,
  DOCKERFILE,
  LABELS,
  RAWJSON_UNSUPPORTED,
  SCRUBBED_ENV_NAMES,
  SCRUBBED_ENV_PREFIXES,
  SERVICE,
} from "./constants";
import { checkDiskSpace } from "./disk";
import { serializeEnv, type EnvValues } from "./env-file";
import { stackEndpoint, waitHealthy } from "./health";
import { SANDBOX_LABELS } from "./labels";
import { resolvePairing, saveConnection } from "./pairing";
import { pullImage } from "./pull";
import { generateToken, loadImageRef, loadSandboxStack, markBuilt, saveSandboxStack } from "./settings";
import { readEnvValues } from "./stack";
import { sandboxDeps, type SandboxCallbacks, type SandboxContext, type SandboxDeps } from "./types";
import { loadBuildWeights } from "./weights";
import { writeEnvAtomic } from "./write";

const PHASE_ORDER: BuildFailurePhase[] = ["preflight", "build", "up", "health", "pair"];
const PHASE_EMIT_INTERVAL_MS = 200;

export interface RunBuildOptions {
  resumeFrom?: BuildFailurePhase;
}

export function renderEnvFile(choices: SetupChoices, ids: { uid: number; gid: number }, secrets: EnvSecrets = { token: "" }): string {
  return serializeEnv(choicesToEnv(choices, ids, secrets));
}

async function devIds(deps: SandboxDeps, claudeDir: string): Promise<{ uid: number; gid: number }> {
  if (deps.platform !== "linux") return { ...DEFAULT_IDS };
  const owner = await stat(claudeDir).catch(() => null);
  if (owner) return { uid: owner.uid, gid: owner.gid };
  return deps.processIds() ?? { ...DEFAULT_IDS };
}

function hostFallback(deps: SandboxDeps): HostResources {
  return { cpus: 1, memBytes: 0, timeZone: DEFAULT_TIME_ZONE, homeDir: deps.homeDir };
}

export async function savedChoices(context: SandboxContext, base: SetupChoices): Promise<SetupChoices> {
  const values = await readEnvValues(context.envFile);
  return values ? { ...choicesFromEnv(values, base), tsAuthKey: "" } : base;
}

function sameComponents(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

export async function writeStack(
  context: SandboxContext,
  choices: SetupChoices,
  validation: ValidationContext = {},
  secrets: Pick<EnvSecrets, "claudeOAuthToken"> = {},
): Promise<SandboxStackConfig> {
  const deps = sandboxDeps(context);
  const existing = await readEnvValues(context.envFile);
  const savedAuthKey = existing?.TS_AUTHKEY ?? "";
  const issues = validateChoices(choices, { ...validation, savedAuthKey: validation.savedAuthKey ?? Boolean(savedAuthKey) });
  if (issues.length > 0) {
    throw new IpcError("invalid_argument", SANDBOX_LABELS.stack.invalidChoices, issues.map((issue) => `${issue.field}: ${issue.message}`).join("\n"));
  }
  const token = existing?.TESSERACT_TOKEN || generateToken();
  const ids = await devIds(deps, choices.hostClaudeDir);
  const claudeOAuthToken = secrets.claudeOAuthToken ?? existing?.CLAUDE_CODE_OAUTH_TOKEN;
  await writeEnvAtomic(context.envFile, renderEnvFile(choices, ids, { token, tsAuthKey: savedAuthKey, claudeOAuthToken }));
  const previous = await loadSandboxStack(context);
  const unchanged =
    previous !== null &&
    previous.image === choices.image &&
    previous.project === choices.project &&
    sameComponents(previous.components, choices.components);
  const stack: SandboxStackConfig = {
    envFile: context.envFile,
    project: choices.project,
    mode: choices.mode,
    image: choices.image,
    builtAt: unchanged ? previous.builtAt : null,
    components: COMPONENTS.filter((component) => choices.components.includes(component)),
  };
  await saveSandboxStack(context, stack);
  return stack;
}

export async function currentStack(context: SandboxContext): Promise<SandboxStackConfig | null> {
  const saved = await loadSandboxStack(context);
  if (saved) return saved;
  const values = await readEnvValues(context.envFile);
  if (!values) return null;
  const choices = choicesFromEnv(values, defaultChoices(hostFallback(sandboxDeps(context)), null));
  return {
    envFile: context.envFile,
    project: choices.project,
    mode: choices.mode,
    image: choices.image,
    builtAt: null,
    components: choices.components,
  };
}

export function buildArgs(values: EnvValues, contextDir: string, project: string): string[] {
  const image = values.TESSERACT_IMAGE as string;
  const arg = (name: string, fallback: string) => ["--build-arg", `${name}=${values[name] || fallback}`];
  return [
    "buildx",
    "build",
    "--progress=rawjson",
    "--file",
    join(contextDir, ...DOCKERFILE),
    "--target",
    BUILD_TARGET,
    "--load",
    "--tag",
    image,
    ...arg("DEV_UID", String(DEFAULT_IDS.uid)),
    ...arg("DEV_GID", String(DEFAULT_IDS.gid)),
    ...arg(COMPONENT_BUILD_ARGS.android, "true"),
    ...arg(COMPONENT_BUILD_ARGS.flutter, "true"),
    ...arg("FLUTTER_VERSION", DEFAULT_FLUTTER_VERSION),
    ...arg(COMPONENT_BUILD_ARGS.mono, "true"),
    ...arg("CLAUDE_CODE_VERSION", DEFAULT_CLAUDE_CODE_VERSION),
    ...arg(COMPONENT_BUILD_ARGS.whisper, "true"),
    ...arg("WHISPER_MODELS", DEFAULT_WHISPER_MODELS.join(" ")),
    "--label",
    `${LABELS.project}=${project}`,
    "--label",
    `${LABELS.service}=${SERVICE}`,
    contextDir,
  ];
}

type StageOutcome = { ok: true } | { ok: false; phase: BuildPhase };

class Runner {
  private lastEmit = 0;
  private lastStep = "";

  constructor(
    readonly deps: SandboxDeps,
    readonly callbacks: SandboxCallbacks,
    readonly signal: AbortSignal,
  ) {}

  phase(phase: BuildPhase): BuildPhase {
    this.callbacks.onPhase?.(phase);
    return phase;
  }

  log(lines: string | string[]): void {
    for (const line of Array.isArray(lines) ? lines : [lines]) this.callbacks.onLog?.(line);
  }

  failed(phase: BuildFailurePhase, message: string): StageOutcome {
    return { ok: false, phase: { kind: "failed", phase, message } };
  }

  building(snapshot: BuildSnapshot, force = false): void {
    const now = this.deps.now();
    if (!force && snapshot.step === this.lastStep && now - this.lastEmit < PHASE_EMIT_INTERVAL_MS) return;
    this.lastEmit = now;
    this.lastStep = snapshot.step;
    this.phase({ kind: "building", ...snapshot });
  }
}

async function preflight(runner: Runner, values: EnvValues, mode: BuildMode): Promise<StageOutcome> {
  runner.phase({ kind: "preflight" });
  let report;
  try {
    report = await runner.deps.probeDocker();
  } catch (error) {
    return runner.failed("preflight", error instanceof Error ? error.message : String(error));
  }
  if (!isDockerReady(report, runner.deps.platform)) return runner.failed("preflight", SANDBOX_LABELS.build.dockerNotReady);
  if (mode !== "existing") {
    const components = mode === "build" ? COMPONENTS.filter((component) => values[COMPONENT_BUILD_ARGS[component]] !== "false") : [...COMPONENTS];
    const disk = await checkDiskSpace(runner.deps, report, components);
    if (disk.kind === "low") return runner.failed("preflight", SANDBOX_LABELS.build.diskLow(disk.freeGb, disk.path, disk.needGb));
    if (disk.kind === "vm") runner.log(SANDBOX_LABELS.build.diskVm(disk.needGb));
  }
  const claudeDir = values.TESSERACT_HOST_CLAUDE_DIR;
  if (claudeDir && !existsSync(claudeDir)) return runner.failed("preflight", SANDBOX_LABELS.build.claudeDirMissing(claudeDir));
  return { ok: true };
}

async function buildImage(runner: Runner, context: SandboxContext, values: EnvValues, env: NodeJS.ProcessEnv): Promise<StageOutcome> {
  const project = values.TESSERACT_COMPOSE_PROJECT as string;
  const weights = await loadBuildWeights(context.contextDir);
  const run = async (plain: boolean) => {
    const progress = new BuildProgress(weights);
    const nonJson: string[] = [];
    const args = buildArgs(values, context.contextDir, project).map((arg) => (plain && arg === "--progress=rawjson" ? "--progress=plain" : arg));
    const onLine = (line: string) => {
      const out = plain ? progress.pushPlain(line) : progress.pushRaw(line);
      if (!plain && out.length === 1 && out[0] === line && line.trim()) nonJson.push(line.trim());
      runner.log(out);
      const snapshot = progress.snapshot();
      if (snapshot.fraction !== null || snapshot.step) runner.building(snapshot);
    };
    runner.phase({ kind: "building", fraction: null, step: "", cachedSteps: 0, doneSteps: 0, totalSteps: null });
    const result = await runner.deps.stream("docker", args, { env, cwd: context.contextDir, signal: runner.signal, onStdout: onLine, onStderr: onLine });
    return { result, progress, nonJson };
  };
  let attempt = await run(false);
  const unsupported = attempt.result.code !== 0 && attempt.progress.snapshot().totalSteps === null && attempt.nonJson.some((line) => RAWJSON_UNSUPPORTED.test(line));
  if (unsupported && !runner.signal.aborted) attempt = await run(true);
  const { result, progress, nonJson } = attempt;
  if (result.cancelled || runner.signal.aborted) return { ok: false, phase: { kind: "cancelled" } };
  if (result.code !== 0) {
    const failure = progress.failure();
    if (failure) runner.log(failure.logs);
    return runner.failed("build", failure?.message ?? result.error ?? nonJson.at(-1) ?? SANDBOX_LABELS.build.failed(result.code));
  }
  runner.building(progress.snapshot(), true);
  if (progress.allCached()) runner.log(SANDBOX_LABELS.build.upToDate);
  return { ok: true };
}

async function pullStage(runner: Runner, context: SandboxContext, values: EnvValues, env: NodeJS.ProcessEnv): Promise<StageOutcome> {
  const image = values.TESSERACT_IMAGE as string;
  const ref = (await loadImageRef(context)) ?? image;
  runner.phase({ kind: "pulling", fraction: null, detail: ref });
  let lastEmit = 0;
  const result = await pullImage(
    runner.deps,
    env,
    ref,
    {
      onLog: (line) => runner.log(line),
      onProgress: (fraction, detail) => {
        const now = runner.deps.now();
        if (now - lastEmit < PHASE_EMIT_INTERVAL_MS) return;
        lastEmit = now;
        runner.phase({ kind: "pulling", fraction, detail });
      },
    },
    runner.signal,
  );
  if (!result.ok) return result.cancelled ? { ok: false, phase: { kind: "cancelled" } } : runner.failed("pull", result.message);
  if (ref !== image) {
    const tagged = await runner.deps.run("docker", ["tag", ref, image], { timeoutMs: DOCKER_TIMEOUT_MS, env });
    if (tagged.code !== 0) return runner.failed("pull", tagged.stderr.trim() || SANDBOX_LABELS.build.pullFailed(tagged.code));
  }
  return { ok: true };
}

async function imageId(deps: SandboxDeps, env: NodeJS.ProcessEnv, image: string): Promise<string | null> {
  const result = await deps.run("docker", ["image", "inspect", "--format", "{{.Id}}", image], { timeoutMs: DOCKER_TIMEOUT_MS, env });
  return result.code === 0 ? result.stdout.trim() || null : null;
}

async function imageStage(runner: Runner, context: SandboxContext, mode: BuildMode, values: EnvValues, env: NodeJS.ProcessEnv): Promise<StageOutcome> {
  if (mode === "build") return buildImage(runner, context, values, env);
  if (mode === "pull") return pullStage(runner, context, values, env);
  const image = values.TESSERACT_IMAGE as string;
  return (await imageId(runner.deps, env, image)) ? { ok: true } : runner.failed("build", SANDBOX_LABELS.build.imageMissing(image));
}

function failurePhaseIndex(phase: BuildFailurePhase | undefined): number {
  if (!phase) return 0;
  return PHASE_ORDER.indexOf(phase === "pull" ? "build" : phase);
}

export async function runBuild(
  context: SandboxContext,
  mode: BuildMode,
  callbacks: SandboxCallbacks,
  signal: AbortSignal,
  options: RunBuildOptions = {},
): Promise<BuildPhase> {
  const deps = sandboxDeps(context);
  const runner = new Runner(deps, callbacks, signal);
  const cancelled = (): BuildPhase => {
    runner.log(SANDBOX_LABELS.build.cancelled);
    return runner.phase({ kind: "cancelled" });
  };
  const values = await readEnvValues(context.envFile);
  if (!values) return runner.phase({ kind: "failed", phase: "preflight", message: SANDBOX_LABELS.stack.notConfigured });
  const filled: EnvValues = {
    ...values,
    TESSERACT_COMPOSE_PROJECT: values.TESSERACT_COMPOSE_PROJECT || DEFAULT_PROJECT,
    TESSERACT_IMAGE: values.TESSERACT_IMAGE || DEFAULT_IMAGE,
  };
  const env = scrubEnv(context.env, SCRUBBED_ENV_PREFIXES, SCRUBBED_ENV_NAMES);
  const endpoint = stackEndpoint(filled, context.env);
  const start = failurePhaseIndex(options.resumeFrom);
  const finish = (outcome: StageOutcome): BuildPhase | null => {
    if (outcome.ok) return null;
    return outcome.phase.kind === "cancelled" ? cancelled() : runner.phase(outcome.phase);
  };

  if (start <= 0) {
    const stopped = finish(await preflight(runner, filled, mode));
    if (stopped) return stopped;
  }
  if (signal.aborted) return cancelled();
  if (start <= 1) {
    const stopped = finish(await imageStage(runner, context, mode, filled, env));
    if (stopped) return stopped;
  }
  if (signal.aborted) return cancelled();
  if (start <= 2) {
    runner.phase({ kind: "starting" });
    try {
      await composeUp(context, { onLog: (line) => runner.log(line), signal });
    } catch (error) {
      if (signal.aborted) return cancelled();
      return runner.phase({ kind: "failed", phase: "up", message: error instanceof Error ? error.message : String(error) });
    }
  }
  if (signal.aborted) return cancelled();
  let healthyUrl: string | null = null;
  if (start <= 3) {
    runner.phase({ kind: "waiting", since: deps.now() });
    const health = await waitHealthy(deps, endpoint, signal);
    if (health.kind === "cancelled") return cancelled();
    if (health.kind === "failed") {
      runner.log(health.logs);
      return runner.phase({ kind: "failed", phase: "health", message: health.message });
    }
    healthyUrl = health.url;
  }
  if (signal.aborted) return cancelled();
  runner.phase({ kind: "pairing" });
  const paired = await resolvePairing(deps, endpoint, filled, healthyUrl, signal);
  if (!paired.ok) return runner.phase({ kind: "failed", phase: "pair", message: paired.message });
  runner.log(paired.message);
  await saveConnection(context, paired.connection);
  await markBuilt(context, new Date(deps.now()).toISOString());
  const id = await imageId(deps, env, filled.TESSERACT_IMAGE as string);
  return runner.phase({ kind: "done", apiUrl: paired.connection.apiUrl, imageId: id ?? "" });
}
