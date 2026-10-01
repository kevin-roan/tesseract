import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { projectIdFromName, type CreateProject, type CreateProjectResponse, type GitDetails, type Project } from "@theone/protocol";
import { mapLimit } from "../core/concurrency";
import { badRequest, conflict, notFound } from "../core/errors";
import { childEnv, run } from "../core/exec";
import { locateProject, type ProjectLocation } from "../core/paths";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import type { Config } from "../config";
import { detectProject } from "./project-detect";
import type { GitService } from "./git";
import type { ProcessService } from "./processes";
import type { SyncBackService } from "./sync-back";

const GIT_INIT_TIMEOUT_MS = 10_000;
const DESCRIBE_CONCURRENCY = 8;
const SYNC_FORMATS = { "application/x-tar": [], "application/gzip": ["-z"] } as const;

export type SyncFormat = keyof typeof SYNC_FORMATS;
export const isSyncFormat = (value: string): value is SyncFormat => Object.hasOwn(SYNC_FORMATS, value);

export class ProjectService {
  constructor(
    private readonly config: Config,
    private readonly git: GitService,
    private readonly hub: EventHub,
    private readonly processes: ProcessService,
    private readonly syncBack: SyncBackService,
    private readonly logger: Logger,
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

  async gitDetails(id: string): Promise<GitDetails> {
    const location = this.require(id);
    const details = await this.git.details(location.path);
    if (!details) throw notFound(`Project ${location.id} is not a git repository`);
    return details;
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

  /** Extracts a tar archive over `<projectsDir>/<id>`, creating the directory when missing. Files the archive lacks are kept. */
  async sync(id: string, format: SyncFormat, archive: ReadableStream<Uint8Array>): Promise<{ project: Project; created: boolean }> {
    const location = locateProject(this.config.projectsDir, id);
    const created = !location.exists;
    if (created) mkdirSync(location.path, { recursive: true });
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

  async publish(id: string): Promise<void> {
    try {
      this.hub.publish({ type: "project.updated", project: await this.get(id) });
    } catch (error) {
      this.logger.debug("project refresh skipped", { project: id, error });
    }
  }

  private async describe(location: ProjectLocation): Promise<Project> {
    const facts = detectProject(location.path);
    const name = typeof facts.pkg?.name === "string" && facts.pkg.name.trim() ? facts.pkg.name.trim() : location.id;
    return {
      id: location.id,
      name,
      path: location.path,
      framework: facts.framework,
      packageManager: facts.packageManager,
      scripts: facts.scripts,
      buildTargets: facts.buildTargets,
      git: await this.git.summary(location.path),
    };
  }
}
