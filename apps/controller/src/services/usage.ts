import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  LIMITS,
  type AgentRun,
  type ClaudeSession,
  type SessionsQuery,
  type TerminalInfo,
  type TokenUsage,
  type UsageByModel,
  type UsageByProject,
  type UsageDay,
  type UsageQuery,
  type UsageReport,
  type UsageTotals,
} from "@theone/protocol";
import type { Config } from "../config";
import { mapLimit } from "../core/concurrency";
import { realpathOrNull } from "../core/paths";
import { projectForCwd } from "./ports";
import { addUsage, emptyUsage, listTranscripts, newTranscript, refreshTranscript, type Transcript, type TranscriptFile } from "./transcripts";

export type SessionSources = {
  /** Every stored agent run. */
  runs: () => AgentRun[];
  /** Terminals of the current controller lifetime. */
  terminals: () => TerminalInfo[];
};

type AccountFile = TranscriptFile & { accountId: string };
type Links = { runs: Map<string, AgentRun>; terminals: Map<string, string>; resumed: Set<string> };

const DAY_MS = 86_400_000;
const PARSE_CONCURRENCY = 8;

const totalsOf = (): UsageTotals => ({ ...emptyUsage(), messages: 0, sessions: 0 });
const byTokens = <T extends TokenUsage>(key: (item: T) => string) => (a: T, b: T) =>
  b.totalTokens - a.totalTokens || key(a).localeCompare(key(b));

export class UsageService {
  private readonly cache = new Map<string, Transcript>();
  private readonly inflight = new Map<string, Promise<Transcript>>();

  constructor(
    private readonly config: Config,
    private readonly sources: SessionSources,
    private readonly now: () => number = Date.now,
  ) {}

  async usage(query: UsageQuery = {}): Promise<UsageReport> {
    const days = query.days ?? LIMITS.defaultUsageDays;
    const now = new Date(this.now());
    const fromMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * DAY_MS;
    const from = new Date(fromMs).toISOString();

    const daily = new Map<string, UsageDay & { ids: Set<string> }>();
    for (let index = 0; index < days; index += 1) {
      const date = new Date(fromMs + index * DAY_MS).toISOString().slice(0, 10);
      daily.set(date, { date, ...totalsOf(), ids: new Set() });
    }
    const totals = totalsOf();
    const sessionIds = new Set<string>();
    const models = new Map<string, UsageByModel>();
    const projects = new Map<string, UsageByProject & { ids: Set<string> }>();
    /** Resumed sessions copy earlier messages into a new file; the oldest file keeps them. */
    const seen = new Set<string>();

    const files = (await this.files()).filter((file) => file.mtimeMs >= fromMs);
    const transcripts = await mapLimit(files, PARSE_CONCURRENCY, (file) => this.load(file));
    const started = (transcript: Transcript) => transcript.startedAt ?? new Date(transcript.mtimeMs).toISOString();
    transcripts.sort((a, b) => started(a).localeCompare(started(b)) || a.path.localeCompare(b.path));
    for (const transcript of transcripts) {
      const projectId = this.projectOf(transcript.cwd);
      for (const [key, record] of transcript.records) {
        const day = daily.get(record.day);
        if (!day || seen.has(key)) continue;
        seen.add(key);
        const model = models.get(record.model) ?? { model: record.model, ...emptyUsage(), messages: 0 };
        models.set(record.model, model);
        const projectKey = projectId ?? "";
        const project = projects.get(projectKey) ?? { projectId, ...emptyUsage(), messages: 0, sessions: 0, ids: new Set() };
        projects.set(projectKey, project);
        for (const target of [totals, day, model, project]) {
          addUsage(target, record.tokens);
          target.messages += 1;
        }
        sessionIds.add(transcript.sessionId);
        day.ids.add(transcript.sessionId);
        project.ids.add(transcript.sessionId);
      }
    }

    totals.sessions = sessionIds.size;
    return {
      generatedAt: now.toISOString(),
      from,
      to: now.toISOString(),
      days,
      totals,
      daily: [...daily.values()].map(({ ids, ...day }) => ({ ...day, sessions: ids.size })),
      models: [...models.values()].sort(byTokens((item) => item.model)),
      projects: [...projects.values()]
        .map(({ ids, ...project }) => ({ ...project, sessions: ids.size }))
        .sort(byTokens((item) => item.projectId ?? "")),
    };
  }

  async sessions(query: SessionsQuery = {}): Promise<ClaudeSession[]> {
    const limit = query.limit ?? LIMITS.defaultSessionsList;
    const files = await this.files();
    const main = files.filter((file) => !file.subagent).sort((a, b) => b.mtimeMs - a.mtimeMs);
    const subagents = new Map<string, AccountFile[]>();
    for (const file of files) {
      if (file.subagent) subagents.set(file.sessionId, [...(subagents.get(file.sessionId) ?? []), file]);
    }
    const links = await this.links(main);

    const sessions: ClaudeSession[] = [];
    for (const file of main) {
      if (sessions.length >= limit) break;
      if (links.resumed.has(file.sessionId)) continue;
      const transcript = await this.load(file);
      const projectId = this.projectOf(transcript.cwd);
      if (query.projectId !== undefined && projectId !== query.projectId) continue;
      const usage = { ...transcript.usage };
      let messages = transcript.records.size;
      for (const child of await mapLimit(subagents.get(file.sessionId) ?? [], PARSE_CONCURRENCY, (sub) => this.load(sub))) {
        addUsage(usage, child.usage);
        messages += child.records.size;
      }
      const modified = new Date(file.mtimeMs).toISOString();
      const run = links.runs.get(file.sessionId) ?? null;
      const terminalId = links.terminals.get(file.sessionId) ?? null;
      sessions.push({
        sessionId: file.sessionId,
        claudeAccountId: file.accountId,
        projectId,
        cwd: transcript.cwd,
        title: transcript.title,
        preview: transcript.preview,
        model: transcript.model,
        startedAt: transcript.startedAt ?? modified,
        lastActiveAt: transcript.lastActiveAt ?? modified,
        messages,
        usage,
        source: run ? "agent-run" : terminalId ? "terminal" : "cli",
        agentRunId: run?.id ?? null,
        terminalId,
        active: run?.state === "running" || terminalId !== null,
      });
    }
    return sessions.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  }

  private projectOf(cwd: string | null): string | null {
    const real = realpathOrNull(this.config.projectsDir);
    return (real ? projectForCwd(real, cwd) : null) ?? projectForCwd(this.config.projectsDir, cwd);
  }

  /** Transcripts of every Claude account's config dir. */
  private async files(): Promise<AccountFile[]> {
    const perAccount = await Promise.all(
      this.config.claudeAccounts.map(async (account) =>
        (await listTranscripts(join(account.configDir, "projects"))).map((file) => ({ ...file, accountId: account.id })),
      ),
    );
    const files = perAccount.flat();
    const present = new Set(files.map((file) => file.path));
    for (const path of this.cache.keys()) {
      if (!present.has(path)) this.cache.delete(path);
    }
    return files;
  }

  /** Parses each file at most once at a time; concurrent callers share the refresh. */
  private async load(file: TranscriptFile): Promise<Transcript> {
    for (let pending = this.inflight.get(file.path); pending; pending = this.inflight.get(file.path)) {
      await pending;
    }
    const task = refreshTranscript(this.cache.get(file.path), file)
      .then((transcript) => {
        this.cache.set(file.path, transcript);
        return transcript;
      })
      .catch(() => {
        this.cache.delete(file.path);
        return newTranscript(file);
      })
      .finally(() => this.inflight.delete(file.path));
    this.inflight.set(file.path, task);
    return task;
  }

  /**
   * Newest agent run per session id, the sessions a follow-up resumed under a new id, and the session each running Claude terminal works on:
   * Claude Code's `<config>/sessions/<pid>.json` when present, else the newest transcript with
   * the terminal's cwd written since the terminal started that no other terminal or live run claims.
   */
  private async links(main: TranscriptFile[]): Promise<Links> {
    const runs = new Map<string, AgentRun>();
    const resumed = new Set<string>();
    for (const run of this.sources.runs()) {
      if (run.resumedSessionId && run.sessionId && run.resumedSessionId !== run.sessionId) resumed.add(run.resumedSessionId);
      if (!run.sessionId) continue;
      const known = runs.get(run.sessionId);
      if (!known || run.startedAt > known.startedAt) runs.set(run.sessionId, run);
    }

    const terminals = new Map<string, string>();
    const claimed = new Set([...runs.values()].filter((run) => run.state === "running").map((run) => run.sessionId as string));
    const live = this.sources
      .terminals()
      .filter((terminal) => terminal.kind === "claude" && terminal.state === "running")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const unresolved: TerminalInfo[] = [];
    for (const terminal of live) {
      const sessionId = terminal.pid === null ? null : await this.sessionOfPid(terminal.pid);
      if (sessionId && !terminals.has(sessionId)) {
        terminals.set(sessionId, terminal.id);
        claimed.add(sessionId);
      } else {
        unresolved.push(terminal);
      }
    }
    for (const terminal of unresolved) {
      const createdMs = Date.parse(terminal.createdAt);
      for (const file of main) {
        if (file.mtimeMs < createdMs || claimed.has(file.sessionId)) continue;
        if ((await this.load(file)).cwd !== terminal.cwd) continue;
        terminals.set(file.sessionId, terminal.id);
        claimed.add(file.sessionId);
        break;
      }
    }
    return { runs, terminals, resumed };
  }

  private async sessionOfPid(pid: number): Promise<string | null> {
    for (const account of this.config.claudeAccounts) {
      try {
        const data: unknown = JSON.parse(await readFile(join(account.configDir, "sessions", `${pid}.json`), "utf8"));
        if (typeof data !== "object" || data === null) continue;
        const { pid: owner, sessionId } = data as { pid?: unknown; sessionId?: unknown };
        if (owner === pid && typeof sessionId === "string" && sessionId) return sessionId;
      } catch {
        continue;
      }
    }
    return null;
  }
}
