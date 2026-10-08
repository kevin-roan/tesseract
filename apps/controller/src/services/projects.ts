import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  projectIdFromName,
  REDACTED,
  type CreateProject,
  type CreateProjectResponse,
  type DeletedProject,
  type GitDetails,
  type Project,
} from "@tesseract/protocol";
import { mapLimit } from "../core/concurrency";
import { badRequest, conflict, HttpError, notFound } from "../core/errors";
import { childEnv, run } from "../core/exec";
import { locateProject, type ProjectLocation } from "../core/paths";
import { nowIso } from "../core/time";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import type { Repositories } from "../db/repositories";
import type { Config } from "../config";
import { detectProject } from "./project-detect";
import type { GitService } from "./git";
import type { ProcessService } from "./processes";
import type { SyncBackService } from "./sync-back";

const GIT_INIT_TIMEOUT_MS = 10_000;
const TRASH_MOVE_TIMEOUT_MS = 10 * 60_000;
const DESCRIBE_CONCURRENCY = 8;
const SYNC_FORMATS = { "application/x-tar": [], "application/gzip": ["-z"] } as const;

export type SyncFormat = keyof typeof SYNC_FORMATS;
export const isSyncFormat = (value: string): value is SyncFormat => Object.hasOwn(SYNC_FORMATS, value);

/** Running work inside a project, as short labels ("process npm run dev"). */
export type ActiveWork = (projectId: string) => string[];

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export class ProjectService {
  constructor(
    private readonly config: Config,
    private readonly git: GitService,
    private readonly hub: EventHub,
    private readonly processes: ProcessService,
    private readonly syncBack: SyncBackService,
    private readonly repos: Repositories,
    private readonly logger: Logger,
    private readonly activeWork: ActiveWork = () => [],
  ) {}

  require(id: string): ProjectLocation {
    const location = locateProject(this.config.projectsDir, id);
    if (!location.exists) throw notFound(`Project ${location.id} not found`);
    return location;
  }

  ids(): string[] {
    let entries;
    try {
      entries = readdirSync(this.config.projectsDir, { withFileTypes: true });
    } catch {
      return [];
    }
    return entries
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .filter((name) => {
        try {
          return locateProject(this.config.projectsDir, name).id === name;
        } catch {
          return false;
        }
      })
      .sort();
  }

  count(): number {
    return this.ids().length;
  }

  async list(): Promise<Project[]> {
    return mapLimit(this.ids(), DESCRIBE_CONCURRENCY, (id) => this.describe(this.require(id)));
  }

  async get(id: string): Promise<Project> {
    return this.describe(this.require(id));
  }

  isConfidential(id: string): boolean {
    return this.repos.isConfidential(id);
  }

  /** One-way: nothing in the API clears the mark. */
  markConfidential(id: string): void {
    this.repos.markConfidential(id, nowIso());
  }

  /** Pins the project to a Claude account (null follows the default); callers validate the account. */
  async setClaudeAccount(id: string, accountId: string | null): Promise<Project> {
    const location = this.require(id);
    this.repos.setProjectClaudeAccount(location.id, accountId, nowIso());
    const project = await this.describe(location);
    this.hub.publish({ type: "project.updated", project });
    return project;
  }

  /** Display name only: the directory and id stay, so host sync, runs and processes keep working. Null restores the detected name. */
  async rename(id: string, name: string | null): Promise<Project> {
    const location = this.require(id);
    this.repos.setProjectName(location.id, name, nowIso());
    const project = await this.describe(location);
    this.hub.publish({ type: "project.updated", project });
    return project;
  }

  async gitDetails(id: string): Promise<GitDetails> {
    const location = this.require(id);
    const details = await this.git.details(location.path);
    if (!details) throw notFound(`Project ${location.id} is not a git repository`);
    if (!this.isConfidential(location.id)) return details;
    return { ...details, log: details.log.map((commit) => ({ ...commit, author: REDACTED })) };
  }

  async create(input: CreateProject): Promise<CreateProjectResponse> {
    const id = projectIdFromName(input.name);
    if (!id) throw badRequest("Project name must contain letters or digits");
    const location = locateProject(this.config.projectsDir, id);
    if (location.exists) throw conflict(`Project ${id} already exists`);
    try {
      mkdirSync(location.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw conflict(`Project ${id} already exists`);
      throw error;
    }
    if (input.confidential) this.markConfidential(id);

    if (input.gitUrl) {
      const clone = this.processes.spawn({
        projectId: id,
        name: `git clone ${id}`,
        command: ["git", "clone", "--progress", ...(input.branch ? ["--branch", input.branch] : []), "--", input.gitUrl, "."],
        cwd: location.path,
        env: { GIT_TERMINAL_PROMPT: "0" },
        onExit: () => void this.publish(id),
      });
      const project = await this.get(id);
      this.hub.publish({ type: "project.updated", project });
      return { project, processId: clone.id };
    }

    const init = await run(["git", "init", "-q"], { cwd: location.path, timeoutMs: GIT_INIT_TIMEOUT_MS });
    if (!init.ok) this.logger.warn("git init failed", { project: id, stderr: init.stderr.trim() || init.error });
    const project = await this.get(id);
    this.hub.publish({ type: "project.updated", project });
    return { project };
  }

  /**
   * Extracts a tar archive over `<projectsDir>/<id>`, creating the directory when missing. Files the archive lacks are kept.
   * `confidential` marks the project before anything is extracted or described.
   */
  async sync(
    id: string,
    format: SyncFormat,
    archive: ReadableStream<Uint8Array>,
    options: { confidential?: boolean } = {},
  ): Promise<{ project: Project; created: boolean }> {
    const location = locateProject(this.config.projectsDir, id);
    const created = !location.exists;
    if (created) mkdirSync(location.path, { recursive: true });
    if (options.confidential) this.markConfidential(location.id);
    const tar = Bun.spawn(["tar", "-x", ...SYNC_FORMATS[format], "-f", "-", "-C", location.path, "--no-same-owner"], {
      env: childEnv(),
      stdin: "pipe",
      stdout: "ignore",
      stderr: "pipe",
    });
    try {
      for await (const chunk of archive) {
        tar.stdin.write(chunk);
        await tar.stdin.flush();
      }
    } catch (error) {
      tar.kill("SIGKILL");
      if (created) rmSync(location.path, { recursive: true, force: true });
      throw error;
    } finally {
      try {
        await tar.stdin.end();
      } catch {}
    }
    const [stderr, code] = await Promise.all([new Response(tar.stderr).text(), tar.exited]);
    if (code !== 0) {
      if (created) rmSync(location.path, { recursive: true, force: true });
      throw badRequest(`Could not extract the archive: ${stderr.trim().split("\n").at(-1) || `tar exited with ${code}`}`);
    }
    try {
      await this.syncBack.recordBaseline(location.id);
    } catch (error) {
      this.logger.warn("could not record the sync-back baseline", { project: location.id, error });
    }
    const project = await this.get(location.id);
    this.hub.publish({ type: "project.updated", project });
    return { project, created };
  }

  /**
   * Moves `<projectsDir>/<id>` to `<trashDir>/<id>-<timestamp>`; the host copy is never touched.
   * Without `force`, refuses (409) a project with changes not synced back to the host, or one that never came from a host.
   */
  async remove(id: string, options: { force?: boolean } = {}): Promise<DeletedProject> {
    const location = this.require(id);
    const busy = this.activeWork(location.id);
    if (busy.length > 0) throw conflict(`Stop ${busy.join(", ")} in project ${location.id} first`);
    this.syncBack.assertIdle(location.id);
    if (!options.force) {
      const { baselineAt, changes } = await this.syncBack.changes(location.id);
      if (baselineAt === null) throw conflict(`Project ${location.id} was never synced from a host, so the sandbox has the only copy`);
      if (changes.length > 0) throw conflict(`Project ${location.id} has ${plural(changes.length, "change")} not synced back to the host`);
    }
    mkdirSync(this.config.trashDir, { recursive: true, mode: 0o700 });
    const trashPath = join(this.config.trashDir, `${location.id}-${nowIso().replace(/[-:.]/g, "")}`);
    const moved = await run(["mv", "-T", "--", join(this.config.projectsDir, location.id), trashPath], { timeoutMs: TRASH_MOVE_TIMEOUT_MS });
    if (!moved.ok) {
      throw new HttpError("internal", `Could not move project ${location.id}: ${moved.stderr.trim() || moved.error || `mv exited with ${moved.code}`}`);
    }
    this.repos.setProjectName(location.id, null, nowIso());
    try {
      await this.syncBack.forget(location.id);
    } catch (error) {
      this.logger.warn("could not drop the sync-back baseline", { project: location.id, error });
    }
    this.logger.info("project moved out of the sandbox", { project: location.id, trashPath });
    this.hub.publish({ type: "project.deleted", id: location.id });
    return { id: location.id, trashPath };
  }

  async publish(id: string): Promise<void> {
    try {
      this.hub.publish({ type: "project.updated", project: await this.get(id) });
    } catch (error) {
      this.logger.debug("project refresh skipped", { project: id, error });
    }
  }

  private async describe(location: ProjectLocation): Promise<Project> {
    const facts = detectProject(location.path);
    const confidential = this.isConfidential(location.id);
    const pkgName = typeof facts.pkg?.name === "string" ? facts.pkg.name.trim() : "";
    const name = this.repos.projectName(location.id) ?? (!confidential && pkgName ? pkgName : location.id);
    return {
      id: location.id,
      name,
      path: location.path,
      framework: facts.framework,
      packageManager: facts.packageManager,
      scripts: facts.scripts,
      dependenciesInstalled: facts.dependenciesInstalled,
      buildTargets: facts.buildTargets,
      git: await this.git.summary(location.path),
      confidential,
      claudeAccountId: this.repos.projectClaudeAccount(location.id),
    };
  }
}
