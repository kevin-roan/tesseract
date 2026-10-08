import {
  AGENT_SESSION_ID_PATTERN,
  createId,
  LIMITS,
  type AgentRun,
  type AgentRunBatchResult,
  type AgentRunDetail,
  type AgentRunEvent,
  type ArchiveAgentRuns,
  type DeleteAgentRuns,
  type StartAgentRun,
  type Upload,
} from "@theone/protocol";
import { badRequest, notFound, unavailable } from "../core/errors";
import { childEnv, resolveExecutable } from "../core/exec";
import { LineSplitter } from "../core/line-splitter";
import { locateProject } from "../core/paths";
import { describeLeftovers, reapGroup, terminateGroup } from "../core/process-group";
import { RingBuffer } from "../core/ring-buffer";
import { nowIso } from "../core/time";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import type { Repositories } from "../db/repositories";
import type { Config } from "../config";
import type { ClaudeAccountResolver } from "./claude-accounts";
import { confidentialPrompt, type ConfidentialProjects } from "./confidential";
import { AgentStreamParser, toEvent, type AgentEventBody, type AgentStreamResult } from "./agent-stream";
import type { UploadService } from "./uploads";

export type AgentEventListener = (event: AgentRunEvent) => void;

type LiveRun = {
  run: AgentRun;
  events: AgentRunEvent[];
  proc: Bun.Subprocess<"pipe", "pipe", "pipe">;
  listeners: Set<AgentEventListener>;
  stderr: RingBuffer<string>;
  result: AgentStreamResult | null;
  cancelRequested: boolean;
  finished: Promise<AgentRun>;
};

const MAX_NDJSON_LINE_CHARS = 32 * 1024 * 1024;
const STDERR_LINES = 20;
const READER_GRACE_MS = 1_000;

export type ClaudeArgsOptions = {
  resumeSessionId?: string;
  attachments?: readonly Upload[];
  uploadsDir?: string;
  appendSystemPrompt?: string;
};

/** Audio is left out: its transcript already is the prompt, the recording is only kept for replay. */
export function readableAttachments(attachments: readonly Upload[]): Upload[] {
  return attachments.filter((upload) => upload.kind !== "audio");
}

export function attachmentBlock(attachments: readonly Upload[]): string {
  if (attachments.length === 0) return "";
  const lines = attachments.map((upload) => `- ${upload.path} (${upload.mimeType})`);
  return `\n\nAttached files (read them with the Read tool):\n${lines.join("\n")}`;
}

/**
 * The prompt always goes to stdin: as an argument, a prompt such as "--mcp-config=…"
 * or "install" would be parsed by the claude CLI as an option or a subcommand.
 */
export function claudeArgs(prompt: string, permissionMode: string, options: ClaudeArgsOptions = {}): { argv: string[]; stdin: string } {
  const readable = readableAttachments(options.attachments ?? []);
  const argv = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    permissionMode,
    ...(readable.length > 0 && options.uploadsDir ? ["--add-dir", options.uploadsDir] : []),
    ...(options.appendSystemPrompt ? ["--append-system-prompt", options.appendSystemPrompt] : []),
    ...(options.resumeSessionId ? ["--resume", options.resumeSessionId] : []),
  ];
  return { argv, stdin: `${prompt}${attachmentBlock(readable)}` };
}

export class AgentRunService {
  private readonly live = new Map<string, LiveRun>();

  constructor(
    private readonly config: Config,
    private readonly repos: Repositories,
    private readonly hub: EventHub,
    private readonly uploads: UploadService,
    private readonly projects: ConfidentialProjects,
    private readonly accounts: ClaudeAccountResolver,
    private readonly logger: Logger,
    private readonly stopGraceMs: number = LIMITS.processStopGraceMs,
  ) {}

  start(input: StartAgentRun): AgentRun {
    if (input.resumeSessionId !== undefined && !AGENT_SESSION_ID_PATTERN.test(input.resumeSessionId)) {
      throw badRequest("resumeSessionId must be a Claude session id (letters, digits, '.', '_' or '-')");
    }
    let cwd = this.config.workspace;
    let projectId: string | null = null;
    if (input.projectId !== undefined) {
      const location = locateProject(this.config.projectsDir, input.projectId);
      if (!location.exists) throw notFound(`Project ${location.id} not found`);
      cwd = location.path;
      projectId = location.id;
    }
    const attachments = this.uploads.resolve(input.attachmentIds ?? []);
    const claude = resolveExecutable(this.config.claudeBin);
    if (!claude) throw unavailable(`Claude Code (${this.config.claudeBin}) is not installed in this sandbox`);
    const account = this.accounts.resolve(projectId, input.resumeSessionId);

    const run: AgentRun = {
      id: createId("agentRun"),
      projectId,
      prompt: input.prompt,
      mode: input.mode ?? null,
      attachments,
      sessionId: input.resumeSessionId ?? null,
      resumedSessionId: input.resumeSessionId ?? null,
      claudeAccountId: account.id,
      state: "running",
      startedAt: nowIso(),
      endedAt: null,
      usage: null,
      result: null,
      error: null,
      archivedAt: null,
    };
    const { argv, stdin } = claudeArgs(input.prompt, input.mode ?? this.config.claudePermissionMode, {
      resumeSessionId: input.resumeSessionId,
      attachments,
      uploadsDir: this.uploads.root,
      appendSystemPrompt: projectId !== null && this.projects.isConfidential(projectId) ? confidentialPrompt(projectId) : undefined,
    });
    const { CLAUDECODE: _nested, ...env } = childEnv();
    let proc: LiveRun["proc"];
    try {
      proc = Bun.spawn([claude, ...argv], {
        cwd,
        env: { ...env, ...account.env, THEONE_AGENT_RUN_ID: run.id },
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        detached: true,
      });
    } catch (error) {
      throw unavailable(`Could not start Claude Code: ${error instanceof Error ? error.message : String(error)}`);
    }
    proc.stdin.write(stdin);
    void proc.stdin.end();

    const entry: LiveRun = {
      run,
      events: [],
      proc,
      listeners: new Set(),
      stderr: new RingBuffer<string>(STDERR_LINES),
      result: null,
      cancelRequested: false,
      finished: Promise.resolve(run),
    };
    this.live.set(run.id, entry);
    this.commit(run);
    this.logger.info("agent run started", { id: run.id, project: projectId ?? undefined, pid: proc.pid });
    entry.finished = this.watch(entry);
    return { ...run };
  }

  private async watch(entry: LiveRun): Promise<AgentRun> {
    const parser = new AgentStreamParser();
    const stdout = this.readLines(entry.proc.stdout, new LineSplitter({ maxLineChars: MAX_NDJSON_LINE_CHARS, collapseCarriageReturns: false }), (line) => {
      const update = parser.parseLine(line);
      if (!update) return;
      if (update.sessionId && update.sessionId !== entry.run.sessionId) {
        entry.run.sessionId = update.sessionId;
        this.commit(entry.run);
      }
      for (const body of update.events) this.emit(entry, body);
      if (update.result) entry.result = update.result;
    });
    const stderr = this.readLines(entry.proc.stderr, new LineSplitter(), (line) => {
      if (line.trim()) entry.stderr.push(line);
    });
    await entry.proc.exited;
    if (!entry.cancelRequested) {
      await reapGroup(entry.proc.pid, this.stopGraceMs, (leftovers) => {
        this.logger.info("agent run left processes behind", { id: entry.run.id, count: leftovers.length });
        this.emit(entry, { kind: "system", text: describeLeftovers(leftovers) });
      });
    }
    await Promise.race([Promise.all([stdout, stderr]), Bun.sleep(READER_GRACE_MS)]);

    const { run, result, proc } = entry;
    run.endedAt = nowIso();
    if (entry.cancelRequested) {
      run.state = "cancelled";
      run.error = "Cancelled";
    } else if (result) {
      run.state = result.isError ? "failed" : "succeeded";
      run.result = result.result;
      run.usage = result.usage;
      run.error = result.isError ? (result.result ?? result.subtype ?? "Claude reported an error") : null;
    } else {
      run.state = "failed";
      const stderrTail = entry.stderr.toArray().join("\n").trim();
      run.error = stderrTail || `Claude Code exited with code ${proc.exitCode ?? proc.signalCode ?? "unknown"} without a result`;
    }
    if (entry.cancelRequested || !result) this.emit(entry, { kind: "system", text: run.state === "cancelled" ? "Run cancelled" : `Run failed: ${run.error}` });
    this.live.delete(run.id);
    entry.listeners.clear();
    this.commit(run);
    this.logger.info("agent run ended", { id: run.id, state: run.state });
    return { ...run };
  }

  private async readLines(stream: ReadableStream<Uint8Array>, splitter: LineSplitter, onLine: (line: string) => void): Promise<void> {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of splitter.push(value)) onLine(line);
      }
    } catch (error) {
      this.logger.debug("agent stream read failed", { error });
    }
    for (const line of splitter.flush()) onLine(line);
  }

  private emit(entry: LiveRun, body: AgentEventBody): void {
    const event = toEvent(body, entry.events.length + 1, nowIso());
    entry.events.push(event);
    this.repos.appendAgentEvent(entry.run.id, event);
    for (const listener of entry.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.warn("agent event listener failed", { id: entry.run.id, error });
      }
    }
  }

  get(id: string): AgentRunDetail {
    const entry = this.live.get(id);
    if (entry) return { ...entry.run, events: [...entry.events] };
    const run = this.repos.agentRuns.get(id);
    if (!run) throw notFound(`Agent run ${id} not found`);
    return { ...run, events: this.repos.agentEvents(id) };
  }

  list(filter: { projectId?: string; archived?: boolean } = {}): AgentRun[] {
    return this.repos.agentRunList({ projectId: filter.projectId, archived: filter.archived ?? false }).map((run) => {
      const entry = this.live.get(run.id);
      return entry ? { ...entry.run } : run;
    });
  }

  /** Replays stored events, then (for live runs) streams new ones. Returns the unsubscribe function. */
  follow(id: string, onEvent: AgentEventListener): { run: AgentRun; unsubscribe: () => void } {
    const detail = this.get(id);
    const { events, ...run } = detail;
    for (const event of events) onEvent(event);
    const entry = this.live.get(id);
    if (!entry) return { run, unsubscribe: () => {} };
    entry.listeners.add(onEvent);
    return { run, unsubscribe: () => entry.listeners.delete(onEvent) };
  }

  async cancel(id: string): Promise<AgentRun> {
    const entry = this.live.get(id);
    if (!entry) {
      const { events: _events, ...run } = this.get(id);
      return run;
    }
    if (!entry.cancelRequested) {
      entry.cancelRequested = true;
      await terminateGroup(entry.proc.pid, entry.proc.exited, this.stopGraceMs);
    }
    return entry.finished;
  }

  /** Running runs are skipped; publishes `agent.updated` for every run whose archived state changed. */
  archive(input: ArchiveAgentRuns): AgentRunBatchResult {
    const target = "ids" in input ? { ids: input.ids } : { all: true as const, projectId: input.projectId };
    const changed = this.repos.setAgentRunsArchived(target, input.archived ? nowIso() : null, [...this.live.keys()]);
    for (const run of changed) this.hub.publish({ type: "agent.updated", run });
    return { count: changed.length };
  }

  /** Permanently removes finished runs and their events; running runs are skipped. */
  delete(input: DeleteAgentRuns): AgentRunBatchResult {
    const ids = this.repos.deleteAgentRuns(input, [...this.live.keys()]);
    if (ids.length > 0) {
      this.hub.publish({ type: "agent.deleted", ids });
      this.logger.info("agent runs deleted", { count: ids.length });
    }
    return { count: ids.length };
  }

  running(): AgentRun[] {
    return [...this.live.values()].map((entry) => ({ ...entry.run }));
  }

  runningCount(): number {
    return this.live.size;
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      [...this.live.values()].map(async (entry) => {
        entry.cancelRequested = true;
        await terminateGroup(entry.proc.pid, entry.proc.exited, 2_000);
        await Promise.race([entry.finished, Bun.sleep(READER_GRACE_MS * 2)]);
      }),
    );
  }

  private commit(run: AgentRun): void {
    this.repos.agentRuns.save(run);
    this.hub.publish({ type: "agent.updated", run: { ...run } });
  }
}
