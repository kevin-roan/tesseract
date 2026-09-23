import { mkdtempSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  createId,
  isFinalBuildState,
  LIMITS,
  type Artifact,
  type BuildJob,
  type BuildState,
  type LogLine,
  type StartBuild,
} from "@theone/protocol";
import { errorMessage, notFound, unavailable } from "../core/errors";
import { childEnv, run } from "../core/exec";
import { isInside, realpathOrNull } from "../core/paths";
import { describeLeftovers, reapGroup, terminateGroup } from "../core/process-group";
import { nowIso } from "../core/time";
import type { EventHub } from "../core/events";
import type { LogChannel, LogStore } from "../core/log-store";
import type { Logger } from "../core/logger";
import type { BuildRecord, Repositories } from "../db/repositories";
import type { Config } from "../config";
import type { ArtifactService } from "./artifacts";
import { resolveRecipe, type CollectSpec, type Recipe } from "./build-recipes";
import { pumpLines } from "./processes";
import { detectProject } from "./project-detect";
import type { ProjectService } from "./projects";
import type { ToolService } from "./tools";

type Job = {
  record: BuildRecord;
  artifacts: Artifact[];
  channel: LogChannel;
  proc: Bun.Subprocess<"ignore", "pipe", "pipe"> | null;
  cancelRequested: boolean;
  done: Promise<void>;
  resolveDone: () => void;
};

const ZIP_TIMEOUT_MS = 10 * 60_000;
const MTIME_SLACK_MS = 2_000;

class BuildFailure extends Error {
  constructor(
    message: string,
    readonly code: number | null,
  ) {
    super(message);
  }
}

export class BuildService {
  private readonly queue: Job[] = [];
  private readonly active = new Map<string, Job>();
  private current: Job | null = null;

  constructor(
    private readonly config: Config,
    private readonly repos: Repositories,
    private readonly logs: LogStore,
    private readonly hub: EventHub,
    private readonly projects: ProjectService,
    private readonly artifacts: ArtifactService,
    private readonly tools: ToolService,
    private readonly logger: Logger,
    private readonly stopGraceMs: number = LIMITS.processStopGraceMs,
  ) {}

  async start(input: StartBuild): Promise<BuildJob> {
    const location = this.projects.require(input.projectId);
    const profile = input.profile ?? "debug";
    const recipe = resolveRecipe({
      facts: detectProject(location.path),
      target: input.target,
      profile,
      display: this.config.display,
    });
    for (const tool of recipe.requires) {
      if (!(await this.tools.has(tool))) throw unavailable(`${tool} is not installed in this sandbox; ${input.target} builds need it`);
    }

    let resolveDone: () => void = () => {};
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
    const id = createId("build");
    const job: Job = {
      record: {
        id,
        projectId: location.id,
        target: input.target,
        profile,
        state: "queued",
        stage: null,
        progress: null,
        startedAt: null,
        endedAt: null,
        createdAt: nowIso(),
        error: null,
      },
      artifacts: [],
      channel: this.logs.open(id),
      proc: null,
      cancelRequested: false,
      done,
      resolveDone,
    };
    job.channel.append("system", `Queued ${input.target} (${profile}) build of ${location.id}`);
    this.active.set(job.record.id, job);
    this.queue.push(job);
    this.commit(job);
    queueMicrotask(() => this.pump());
    return this.snapshot(job);
  }

  get(id: string): BuildJob {
    const job = this.active.get(id);
    if (job) return this.snapshot(job);
    const record = this.repos.builds.get(id);
    if (!record) throw notFound(`Build ${id} not found`);
    return { ...record, artifacts: this.artifacts.forBuild(id) };
  }

  list(projectId?: string): BuildJob[] {
    return this.repos.builds.list({ projectId }).map((record) => {
      const job = this.active.get(record.id);
      return job ? this.snapshot(job) : { ...record, artifacts: this.artifacts.forBuild(record.id) };
    });
  }

  logTail(id: string, tail: number): LogLine[] {
    this.get(id);
    return this.logs.tail(id, tail);
  }

  activeBuilds(): BuildJob[] {
    return [...this.active.values()].map((job) => this.snapshot(job));
  }

  activeCount(): number {
    return this.active.size;
  }

  async cancel(id: string): Promise<BuildJob> {
    const job = this.active.get(id);
    if (!job) return this.get(id);
    if (job.record.state === "queued") {
      const index = this.queue.indexOf(job);
      if (index !== -1) this.queue.splice(index, 1);
      this.finish(job, "cancelled", null, "Cancelled before it started");
      return this.snapshot(job);
    }
    if (!job.cancelRequested) {
      job.cancelRequested = true;
      job.channel.append("system", "Cancelling: SIGTERM to the build process group");
      if (job.proc) await terminateGroup(job.proc.pid, job.proc.exited, this.stopGraceMs);
    }
    await job.done;
    return this.snapshot(job);
  }

  async shutdown(): Promise<void> {
    for (const job of [...this.queue]) this.finish(job, "cancelled", null, "The controller shut down");
    this.queue.length = 0;
    const running = this.current;
    if (!running) return;
    running.cancelRequested = true;
    if (running.proc) await terminateGroup(running.proc.pid, running.proc.exited, 2_000);
    await Promise.race([running.done, Bun.sleep(3_000)]);
  }

  private pump(): void {
    if (this.current) return;
    const next = this.queue.shift();
    if (!next) return;
    this.current = next;
    void this.execute(next).finally(() => {
      this.current = null;
      this.pump();
    });
  }

  private async execute(job: Job): Promise<void> {
    const { record, channel } = job;
    try {
      const location = this.projects.require(record.projectId);
      const facts = detectProject(location.path);
      const recipe = resolveRecipe({
        facts,
        target: record.target,
        profile: record.profile,
        display: this.config.display,
      });
      const total = recipe.steps.length + (recipe.collect ? 1 : 0);
      this.update(job, { state: "running", startedAt: nowIso(), progress: 0 });
      channel.append("system", `Build started in ${location.path}`);

      for (const [index, step] of recipe.steps.entries()) {
        if (job.cancelRequested) break;
        this.update(job, { stage: step.stage, progress: index / total });
        channel.append("system", `▶ ${step.stage}: ${step.command}`);
        const code = await this.runStep(job, step.command, location.path, recipe);
        if (job.cancelRequested) break;
        if (code !== 0) throw new BuildFailure(`Stage ${step.stage} failed with exit code ${code ?? "unknown"}`, code);
      }
      if (job.cancelRequested) {
        this.finish(job, "cancelled", null, "Cancelled");
        return;
      }
      if (recipe.collect) {
        this.update(job, { stage: "collect", progress: recipe.steps.length / total });
        channel.append("system", "▶ collect: gathering artifacts");
        const version = typeof facts.pkg?.version === "string" ? facts.pkg.version : "0.0.0";
        await this.collect(job, location.path, recipe.collect, version);
      }
      this.finish(job, "succeeded", 0, null);
    } catch (error) {
      if (job.cancelRequested) this.finish(job, "cancelled", null, "Cancelled");
      else this.finish(job, "failed", error instanceof BuildFailure ? error.code : null, errorMessage(error));
    }
  }

  private async runStep(job: Job, command: string, cwd: string, recipe: Recipe): Promise<number | null> {
    const proc = Bun.spawn(["bash", "-lc", command], {
      cwd,
      env: { ...childEnv(), ...recipe.env, THEONE_BUILD_ID: job.record.id },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      detached: true,
    });
    job.proc = proc;
    const readers = Promise.all([pumpLines(proc.stdout, job.channel, "stdout"), pumpLines(proc.stderr, job.channel, "stderr")]);
    await proc.exited;
    if (!job.cancelRequested) {
      await reapGroup(proc.pid, this.stopGraceMs, (leftovers) => job.channel.append("system", describeLeftovers(leftovers)));
    }
    await Promise.race([readers, Bun.sleep(500)]);
    job.proc = null;
    return proc.exitCode;
  }

  private async collect(job: Job, projectDir: string, spec: CollectSpec, version: string): Promise<void> {
    const meta = {
      projectId: job.record.projectId,
      buildId: job.record.id,
      platform: spec.platform,
      profile: job.record.profile,
      version,
    };
    if (spec.kind === "zip") {
      const source = spec.candidates
        .map((dir) => realpathOrNull(join(projectDir, dir)))
        .find((dir): dir is string => dir !== null && isInside(projectDir, dir) && statSync(dir).isDirectory());
      if (!source) throw new BuildFailure(`No build output found (looked for ${spec.candidates.join(", ")})`, null);
      const temp = mkdtempSync(join(this.config.dataDir, "zip-"));
      try {
        const archive = join(temp, "web.zip");
        const zipped = await run(["zip", "-r", "-q", "-X", "-y", archive, "."], { cwd: source, timeoutMs: ZIP_TIMEOUT_MS });
        if (!zipped.ok) {
          const fallback = await run(["python3", "-m", "zipfile", "-c", archive, ...this.topLevel(source)], {
            cwd: source,
            timeoutMs: ZIP_TIMEOUT_MS,
          });
          if (!fallback.ok) throw new BuildFailure(`Could not zip ${relative(projectDir, source)}: ${zipped.stderr || zipped.error}`, null);
        }
        this.recordArtifact(job, await this.artifacts.store(archive, meta, { move: true }));
      } finally {
        rmSync(temp, { recursive: true, force: true });
      }
      return;
    }

    const root = join(projectDir, spec.root);
    const realRoot = realpathOrNull(root);
    if (!realRoot || !isInside(projectDir, realRoot)) throw new BuildFailure(`Output directory ${spec.root} does not exist`, null);
    const builtSince = Date.parse(job.record.startedAt ?? "") - MTIME_SLACK_MS;
    const files = new Set<string>();
    for (const pattern of spec.patterns) {
      for await (const match of new Bun.Glob(pattern).scan({ cwd: realRoot, onlyFiles: true, followSymlinks: false })) {
        if (spec.exclude?.test(match)) continue;
        const file = join(realRoot, match);
        // Output directories keep installers from earlier builds and versions; only this build's files count.
        if (statSync(file).mtimeMs < builtSince) continue;
        files.add(file);
      }
    }
    if (files.size === 0) {
      throw new BuildFailure(`No artifacts from this build matched ${spec.patterns.join(", ")} in ${spec.root}`, null);
    }
    for (const file of [...files].sort()) {
      this.recordArtifact(job, await this.artifacts.store(file, meta));
    }
  }

  private topLevel(dir: string): string[] {
    return [...new Bun.Glob("*").scanSync({ cwd: dir, onlyFiles: false, dot: true })];
  }

  private recordArtifact(job: Job, artifact: Artifact): void {
    job.artifacts.push(artifact);
    job.channel.append("system", `Artifact ${artifact.fileName} (${artifact.sizeBytes} bytes, sha256 ${artifact.sha256})`);
    this.commit(job);
  }

  private update(job: Job, patch: Partial<BuildRecord>): void {
    Object.assign(job.record, patch);
    this.commit(job);
  }

  private finish(job: Job, state: BuildState, code: number | null, error: string | null): void {
    if (isFinalBuildState(job.record.state)) return;
    job.channel.append("system", error ? `Build ${state}: ${error}` : `Build ${state}`);
    this.update(job, {
      state,
      error: state === "succeeded" ? null : error,
      progress: state === "succeeded" ? 1 : job.record.progress,
      endedAt: nowIso(),
    });
    job.channel.end(code);
    this.active.delete(job.record.id);
    this.logger.info("build finished", { id: job.record.id, state, error: error ?? undefined });
    job.resolveDone();
  }

  private snapshot(job: Job): BuildJob {
    return { ...job.record, artifacts: [...job.artifacts] };
  }

  private commit(job: Job): void {
    this.repos.builds.save(job.record);
    this.hub.publish({ type: "build.updated", build: this.snapshot(job) });
  }
}
