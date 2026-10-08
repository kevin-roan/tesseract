import type { GitCommit, GitDetails, GitFileStatus, GitSummary } from "@tesseract/protocol";
import { childEnv, run } from "../core/exec";
import { toUtcIso } from "../core/time";

const FIELD = "\x1f";
const RECORD = "\x1e";
const LOG_LIMIT = 20;
const NEUTRAL_CONFIG = ["-c", "core.fsmonitor=false", "-c", "log.showSignature=false"];
const FILTER_KEY = /^filter\.(.+)\.(?:clean|smudge|process)$/;

/** Driver names of `filter.<name>.{clean,smudge,process}` from `git config -z --name-only`. */
export function filterDrivers(output: string): string[] {
  const names = new Set<string>();
  for (const key of output.split("\0")) {
    const name = FILTER_KEY.exec(key)?.[1];
    if (name) names.add(name);
  }
  return [...names];
}

/**
 * Repository config and attributes are untrusted (an unpacked archive brings its own
 * .git): status re-hashes stat-dirty files through filter drivers and honours
 * core.fsmonitor, log runs gpg.program for log.showSignature. Command-line -c wins over them.
 */
export function neutralConfig(drivers: string[]): string[] {
  const filters = drivers.flatMap((name) =>
    ["clean=", "smudge=", "process=", "required=false"].flatMap((setting) => ["-c", `filter.${name}.${setting}`]),
  );
  return [...NEUTRAL_CONFIG, ...filters];
}

type StatusInfo = { branch: string | null; ahead: number; behind: number; files: GitFileStatus[] };

function statusChar(value: string | undefined): string {
  return !value || value === "." ? " " : value;
}

/** Parses `git status --porcelain=v2 --branch -z`. */
export function parseStatus(output: string): StatusInfo {
  const info: StatusInfo = { branch: null, ahead: 0, behind: 0, files: [] };
  const tokens = output.split("\0");
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) continue;
    if (token.startsWith("# branch.head ")) {
      const head = token.slice("# branch.head ".length);
      info.branch = head === "(detached)" ? null : head;
    } else if (token.startsWith("# branch.ab ")) {
      const match = /\+(\d+) -(\d+)/.exec(token);
      info.ahead = Number(match?.[1] ?? 0);
      info.behind = Number(match?.[2] ?? 0);
    } else if (token.startsWith("1 ") || token.startsWith("2 ") || token.startsWith("u ")) {
      const parts = token.split(" ");
      const pathStart = token.startsWith("1 ") ? 8 : token.startsWith("2 ") ? 9 : 10;
      const xy = parts[1] ?? "..";
      info.files.push({ path: parts.slice(pathStart).join(" "), index: statusChar(xy[0]), worktree: statusChar(xy[1]) });
      if (token.startsWith("2 ")) i += 1;
    } else if (token.startsWith("? ")) {
      info.files.push({ path: token.slice(2), index: "?", worktree: "?" });
    }
  }
  return info;
}

export class GitService {
  constructor(
    private readonly ceilingDir: string,
    private readonly timeoutMs = 3_000,
  ) {}

  private git(dir: string, args: string[], config: string[] = NEUTRAL_CONFIG, timeoutMs = this.timeoutMs) {
    return run(["git", ...config, "-C", dir, ...args], {
      timeoutMs,
      env: {
        ...childEnv(),
        GIT_CEILING_DIRECTORIES: this.ceilingDir,
        GIT_OPTIONAL_LOCKS: "0",
        GIT_TERMINAL_PROMPT: "0",
        LC_ALL: "C",
      },
    });
  }

  private async safeConfig(dir: string): Promise<string[]> {
    const result = await this.git(dir, ["config", "-z", "--name-only", "--get-regexp", "^filter\\."]);
    return neutralConfig(result.ok ? filterDrivers(result.stdout) : []);
  }

  private async status(dir: string, config: string[]): Promise<StatusInfo | null> {
    const result = await this.git(dir, ["status", "--porcelain=v2", "--branch", "-z"], config);
    return result.ok ? parseStatus(result.stdout) : null;
  }

  private async log(dir: string, limit: number, config: string[]): Promise<GitCommit[]> {
    const format = ["%H", "%s", "%an", "%cI"].join("%x1f") + "%x1e";
    const result = await this.git(dir, ["log", `-n${limit}`, `--format=${format}`], config);
    if (!result.ok) return [];
    return result.stdout
      .split(RECORD)
      .map((record) => record.replace(/^\n/, ""))
      .filter(Boolean)
      .map((record) => {
        const [sha = "", subject = "", author = "", date = ""] = record.split(FIELD);
        return { sha, subject, author, date: toUtcIso(date) ?? new Date(0).toISOString() };
      })
      .filter((commit) => commit.sha.length > 0);
  }

  /** Tracked and untracked, not ignored files (`ls-files -co --exclude-standard`), or `null` when `dir` is not a git checkout. */
  async listFiles(dir: string, timeoutMs = 60_000): Promise<string[] | null> {
    const result = await this.git(dir, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], NEUTRAL_CONFIG, timeoutMs);
    if (!result.ok) return null;
    return [...new Set(result.stdout.split("\0").filter(Boolean))];
  }

  /** `<symbolic ref>@<commit sha>` (either side empty when detached or unborn), or `null` when `dir` is not a git checkout. */
  async head(dir: string): Promise<string | null> {
    const repo = await this.git(dir, ["rev-parse", "--git-dir"]);
    if (!repo.ok) return null;
    const [ref, sha] = await Promise.all([
      this.git(dir, ["symbolic-ref", "-q", "HEAD"]),
      this.git(dir, ["rev-parse", "-q", "--verify", "HEAD^{commit}"]),
    ]);
    return `${ref.ok ? ref.stdout.trim() : ""}@${sha.ok ? sha.stdout.trim() : ""}`;
  }

  async summary(dir: string): Promise<GitSummary | null> {
    const config = await this.safeConfig(dir);
    const [status, log] = await Promise.all([this.status(dir, config), this.log(dir, 1, config)]);
    if (!status) return null;
    const last = log[0];
    return {
      branch: status.branch,
      dirty: status.files.length > 0,
      ahead: status.ahead,
      behind: status.behind,
      lastCommit: last ? { sha: last.sha, subject: last.subject, date: last.date } : null,
    };
  }

  async details(dir: string): Promise<GitDetails | null> {
    const config = await this.safeConfig(dir);
    const [status, log] = await Promise.all([this.status(dir, config), this.log(dir, LOG_LIMIT, config)]);
    if (!status) return null;
    return { branch: status.branch, ahead: status.ahead, behind: status.behind, files: status.files, log };
  }
}
