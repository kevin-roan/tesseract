import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import {
  createId,
  DEPLOY_ACTIVE_STATUSES,
  DEPLOY_APP_PATTERN,
  DEPLOY_STATUSES,
  LIMITS,
  type ClaimDeploy,
  type CompleteDeploy,
  type CreateDeploy,
  type Deploy,
  type DeployKind,
  type DeployProgress,
  type DeploysQuery,
  type DeployStatus,
  type DeployTarget,
  type DeployTargets,
  type PutDeployTargets,
} from "@tesseract/protocol";
import { badRequest, conflict, HttpError, notFound } from "../core/errors";
import { childEnv } from "../core/exec";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import { isInside, realpathOrNull } from "../core/paths";
import type { Config } from "../config";
import type { Repositories } from "../db/repositories";
import type { ProjectService } from "./projects";

export const DEPLOYS_KEEP = 200;
export const STALE_DEPLOY_LOG = "\n[tesseract] the desktop app stopped reporting; the deploy is pending again\n";
export const APPROVAL_TIMEOUT_ERROR = "Nobody approved the deploy in the Tesseract desktop app in time";
export const COMPOSE_FILES = ["compose.yml", "compose.yaml", "docker-compose.yml", "docker-compose.yaml"] as const;
/** Names the desktop host refuses for server containers, plus the `deploy` CLI subcommands. */
export const RESERVED_CONTAINER_NAMES: readonly string[] = ["sandbox", "tailscale", "docker", "host", "localhost", "targets", "ls", "status", "cancel"];
export const CREATE_HINT = "pass --create to have the host create it (you will be asked to approve)";

const SWEEP_INTERVAL_MS = 30_000;
const ACTIVE: readonly DeployStatus[] = DEPLOY_ACTIVE_STATUSES;
const FINISHED: readonly DeployStatus[] = DEPLOY_STATUSES.filter((status) => !ACTIVE.includes(status));
const HELD: readonly DeployStatus[] = ["claimed", "awaiting_approval", "deploying"];
const BUNDLE_SUFFIX = ".tar.gz";
const PARTIAL_SUFFIX = ".partial";

export type DeployOptions = {
  now?: () => number;
  sweepIntervalMs?: number;
  claimTimeoutMs?: number;
  approvalTimeoutMs?: number;
  targetsTtlMs?: number;
  maxBundleBytes?: number;
};

type ReportedTargets = { host: string; reportedAt: number; targets: DeployTarget[] };

export function slugAppName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 63)
    .replace(/-+$/, "");
  return DEPLOY_APP_PATTERN.test(slug) ? slug : "app";
}

export function detectDeployKind(dir: string): DeployKind | null {
  if (COMPOSE_FILES.some((file) => existsSync(join(dir, file)))) return "compose";
  return existsSync(join(dir, "Dockerfile")) ? "dockerfile" : null;
}

/** Deploy requests: the controller archives a workspace directory, the desktop host claims and runs it in a server container. */
export class DeployService {
  private readonly dir: string;
  private readonly now: () => number;
  private readonly sweepIntervalMs: number;
  private readonly claimTimeoutMs: number;
  private readonly approvalTimeoutMs: number;
  private readonly targetsTtlMs: number;
  private readonly maxBundleBytes: number;
  private readonly creating = new Set<string>();
  private reported: ReportedTargets | null = null;
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: Config,
    private readonly repos: Repositories,
    private readonly hub: EventHub,
    private readonly projects: ProjectService,
    private readonly logger: Logger,
    options: DeployOptions = {},
  ) {
    this.dir = join(config.dataDir, "deploys");
    this.now = options.now ?? Date.now;
    this.sweepIntervalMs = options.sweepIntervalMs ?? SWEEP_INTERVAL_MS;
    this.claimTimeoutMs = options.claimTimeoutMs ?? LIMITS.deployClaimTimeoutMs;
    this.approvalTimeoutMs = options.approvalTimeoutMs ?? LIMITS.deployApprovalTimeoutMs;
    this.targetsTtlMs = options.targetsTtlMs ?? LIMITS.deployTargetsTtlMs;
    this.maxBundleBytes = options.maxBundleBytes ?? LIMITS.maxDeployBundleBytes;
  }

  start(): void {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    this.cleanBundles();
    this.sweep();
    this.sweeper ??= setInterval(() => this.sweep(), this.sweepIntervalMs);
    this.sweeper.unref?.();
  }

  stop(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
  }

  async create(input: CreateDeploy): Promise<Deploy> {
    const source = this.resolveSource(input.path);
    const kind = detectDeployKind(source);
    if (!kind) throw badRequest(`${source} has no ${COMPOSE_FILES.join(", ")} or Dockerfile to deploy`);
    const app = input.app ?? slugAppName(basename(source));
    this.assertTarget(input.container, input.create === true);
    this.sweep();
    const key = `${input.container}/${app}`;
    const active = this.activeFor(input.container, app);
    if (active || this.creating.has(key)) {
      throw conflict(`App ${app} already has an active deploy to ${input.container}${active ? ` (${active.id}, ${active.status})` : ""}`);
    }
    this.creating.add(key);
    try {
      const id = createId("deploy");
      const { sha256, bytes } = await this.archive(id, source);
      const now = this.timestamp();
      const deploy: Deploy = {
        id,
        container: input.container,
        app,
        kind,
        sourcePath: source,
        projectId: this.projectOf(source),
        port: input.port ?? null,
        hostname: input.hostname ?? null,
        create: input.create === true,
        cpus: input.cpus ?? null,
        memoryMb: input.memoryMb ?? null,
        status: "pending",
        sha256,
        bytes,
        claimedBy: null,
        log: "",
        urls: [],
        error: null,
        createdAt: now,
        updatedAt: now,
      };
      this.repos.deploys.save(deploy);
      this.repos.pruneDeploys(DEPLOYS_KEEP, FINISHED);
      this.hub.publish({ type: "deploy.updated", deploy });
      return deploy;
    } finally {
      this.creating.delete(key);
    }
  }

  list(query: DeploysQuery = {}): Deploy[] {
    this.sweep();
    const clauses: string[] = [];
    const params: string[] = [];
    if (query.status) {
      clauses.push("status = ?");
      params.push(query.status);
    }
    if (query.container) {
      clauses.push("container = ?");
      params.push(query.container);
    }
    if (clauses.length === 0) return this.repos.deploys.list({ limit: LIMITS.maxDeployList });
    return this.repos.deploys.where(clauses.join(" AND "), ...params).slice(0, LIMITS.maxDeployList);
  }

  get(id: string): Deploy {
    this.sweep();
    return this.require(id);
  }

  claim(id: string, input: ClaimDeploy): Deploy {
    this.sweep();
    const deploy = this.requireStatus(id, ["pending"]);
    return this.update({ ...deploy, status: "claimed", claimedBy: input.host });
  }

  progress(id: string, input: DeployProgress): Deploy {
    this.sweep();
    const deploy = this.requireStatus(id, HELD);
    return this.update({ ...deploy, status: input.status, log: this.appendLog(deploy.log, input.log) });
  }

  complete(id: string, input: CompleteDeploy): Deploy {
    this.sweep();
    const deploy = this.requireStatus(id, HELD);
    const fallback = input.status === "failed" ? "Deploy failed" : input.status === "rejected" ? "Deploy rejected" : null;
    return this.update({
      ...deploy,
      status: input.status,
      log: this.appendLog(deploy.log, input.log),
      urls: input.urls ?? deploy.urls,
      error: input.error ?? fallback,
    });
  }

  cancel(id: string): Deploy {
    this.sweep();
    const deploy = this.requireStatus(id, ["pending", "claimed", "awaiting_approval"]);
    return this.update({ ...deploy, status: "cancelled" });
  }

  /** The archive of a deploy the host holds; 409 in any other state. */
  bundle(id: string): { deploy: Deploy; path: string } {
    this.sweep();
    const deploy = this.requireStatus(id, HELD);
    const path = this.bundlePath(id);
    if (!existsSync(path)) throw new HttpError("internal", `The bundle of deploy ${id} is missing`);
    return { deploy, path };
  }

  putTargets(input: PutDeployTargets): DeployTargets {
    this.reported = { host: input.host, reportedAt: this.now(), targets: input.targets };
    return this.getTargets();
  }

  getTargets(): DeployTargets {
    const reported = this.reported;
    if (!reported || this.now() - reported.reportedAt > this.targetsTtlMs) return { host: null, reportedAt: null, targets: [] };
    return { host: reported.host, reportedAt: new Date(reported.reportedAt).toISOString(), targets: reported.targets };
  }

  /** Puts silent claims back to `pending` and rejects approvals that timed out; returns the changed deploys. */
  sweep(now = this.now()): Deploy[] {
    const claimCutoff = new Date(now - this.claimTimeoutMs).toISOString();
    const approvalCutoff = new Date(now - this.approvalTimeoutMs).toISOString();
    const stale = this.repos.deploys
      .where("status IN ('claimed', 'deploying') AND updated_at < ?", claimCutoff)
      .map((deploy) => this.update({ ...deploy, status: "pending", claimedBy: null, log: this.appendLog(deploy.log, STALE_DEPLOY_LOG) }));
    const expired = this.repos.deploys
      .where("status = 'awaiting_approval' AND updated_at < ?", approvalCutoff)
      .map((deploy) => this.update({ ...deploy, status: "rejected", error: APPROVAL_TIMEOUT_ERROR }));
    return [...stale, ...expired];
  }

  private resolveSource(path: string): string {
    if (!isAbsolute(path)) throw badRequest(`Deploy path must be absolute: ${path.slice(0, 200)}`);
    const workspace = realpathOrNull(this.config.workspace) ?? this.config.workspace;
    const real = realpathOrNull(path);
    if (!real || !isInside(workspace, real)) throw badRequest(`${path.slice(0, 200)} is not a directory inside ${this.config.workspace}`);
    if (!statSync(real).isDirectory()) throw badRequest(`${path.slice(0, 200)} is not a directory`);
    for (const internal of [this.config.agentDir, this.config.dataDir]) {
      const resolved = realpathOrNull(internal) ?? internal;
      if (isInside(resolved, real) || isInside(real, resolved)) throw badRequest(`${path.slice(0, 200)} contains controller state and cannot be deployed`);
    }
    return real;
  }

  private assertTarget(container: string, create: boolean): void {
    const { host, targets } = this.getTargets();
    if (targets.some((target) => target.name === container)) return;
    if (RESERVED_CONTAINER_NAMES.includes(container)) {
      throw badRequest(`${container} is a reserved name; pick another container name (not ${RESERVED_CONTAINER_NAMES.join(", ")})`);
    }
    if (host === null || create) return;
    const names = targets.map((target) => target.name);
    throw badRequest(
      `${host} has no server container named ${container}; ${names.length > 0 ? `valid containers: ${names.join(", ")}` : "it has no server containers"}; ${CREATE_HINT}`,
    );
  }

  private activeFor(container: string, app: string): Deploy | undefined {
    return this.repos.deploys.where(`container = ? AND app = ? AND status IN (${ACTIVE.map(() => "?").join(", ")})`, container, app, ...ACTIVE)[0];
  }

  private projectOf(source: string): string | null {
    for (const id of this.projects.ids()) {
      try {
        if (isInside(this.projects.require(id).path, source)) return id;
      } catch {
        continue;
      }
    }
    return null;
  }

  private async archive(id: string, source: string): Promise<{ sha256: string; bytes: number }> {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const partial = `${this.bundlePath(id)}${PARTIAL_SUFFIX}`;
    const tar = Bun.spawn(
      ["tar", "-c", "-z", "-f", "-", "--exclude=.git", "--exclude=node_modules", "--owner=0", "--group=0", "--numeric-owner", "-C", source, "."],
      { env: childEnv(), stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    );
    const hasher = new Bun.CryptoHasher("sha256");
    const writer = Bun.file(partial).writer();
    let bytes = 0;
    let tooLarge = false;
    try {
      for await (const chunk of tar.stdout) {
        bytes += chunk.byteLength;
        if (bytes > this.maxBundleBytes) {
          tooLarge = true;
          tar.kill("SIGKILL");
          break;
        }
        hasher.update(chunk);
        writer.write(chunk);
      }
      await writer.end();
      const [stderr, code] = await Promise.all([new Response(tar.stderr).text(), tar.exited]);
      if (tooLarge) {
        throw badRequest(`The deploy bundle exceeds ${Math.round(this.maxBundleBytes / 1024 / 1024)} MiB (.git and node_modules are already left out)`);
      }
      if (code !== 0 && code !== 1) {
        this.logger.warn("deploy archive failed", { deploy: id, code, stderr: stderr.trim().slice(0, 500) });
        throw badRequest(`Could not archive ${source}: ${stderr.trim().split("\n").at(-1) || `tar exited with ${code}`}`);
      }
      renameSync(partial, this.bundlePath(id));
      return { sha256: hasher.digest("hex"), bytes };
    } catch (error) {
      rmSync(partial, { force: true });
      throw error;
    }
  }

  /** Deletes bundles without an active deploy (and fails active deploys whose bundle is gone). */
  private cleanBundles(): void {
    const keep = new Set<string>();
    for (const deploy of this.repos.deploys.where(`status IN (${ACTIVE.map(() => "?").join(", ")})`, ...ACTIVE)) {
      if (existsSync(this.bundlePath(deploy.id))) keep.add(`${deploy.id}${BUNDLE_SUFFIX}`);
      else this.update({ ...deploy, status: "failed", error: "The deploy bundle was lost when the controller restarted" });
    }
    for (const name of readdirSync(this.dir)) {
      if (!keep.has(name)) rmSync(join(this.dir, name), { recursive: true, force: true });
    }
  }

  private appendLog(log: string, text: string | undefined): string {
    return text ? (log + text).slice(-LIMITS.maxDeployLogLength) : log;
  }

  private bundlePath(id: string): string {
    return join(this.dir, `${id}${BUNDLE_SUFFIX}`);
  }

  private timestamp(): string {
    return new Date(this.now()).toISOString();
  }

  private update(deploy: Deploy): Deploy {
    const next = { ...deploy, updatedAt: this.timestamp() };
    this.repos.deploys.save(next);
    if (FINISHED.includes(next.status)) rmSync(this.bundlePath(next.id), { force: true });
    this.hub.publish({ type: "deploy.updated", deploy: next });
    return next;
  }

  private require(id: string): Deploy {
    const deploy = this.repos.deploys.get(id);
    if (!deploy) throw notFound(`Deploy ${id} not found`);
    return deploy;
  }

  private requireStatus(id: string, statuses: readonly DeployStatus[]): Deploy {
    const deploy = this.require(id);
    if (!statuses.includes(deploy.status)) throw conflict(`Deploy ${id} is ${deploy.status}, not ${statuses.join(" or ")}`);
    return deploy;
  }
}
