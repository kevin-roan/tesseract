import {
  createId,
  LIMITS,
  type CreateTerminal,
  type TerminalInfo,
  type TerminalServerMessage,
} from "@theone/protocol";
import { errorMessage, notFound, unavailable } from "../core/errors";
import { childEnv, resolveExecutable } from "../core/exec";
import { locateProject } from "../core/paths";
import { describeLeftovers, reapGroup, terminateGroup } from "../core/process-group";
import { nowIso } from "../core/time";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import type { Repositories } from "../db/repositories";
import type { Config } from "../config";

export type TerminalClient = {
  send(message: TerminalServerMessage): void;
  close(): void;
};

type Session = {
  info: TerminalInfo;
  proc: Bun.Subprocess;
  terminal: Bun.Terminal;
  clients: Set<TerminalClient>;
  chunks: string[];
  size: number;
  closing: boolean;
  finished: Promise<TerminalInfo>;
};

const EOF_GRACE_MS = 300;
const MAX_EXITED_SESSIONS = 20;
const LINE_SEARCH_BYTES = 4096;
const NEWLINE = 0x0a;

const utf8Length = (text: string) => Buffer.byteLength(text, "utf8");
const isContinuationByte = (byte: number | undefined) => byte !== undefined && (byte & 0xc0) === 0x80;

/**
 * Drops the oldest output beyond `limit` UTF-8 bytes without splitting a character,
 * restarting at a line boundary when one is near. `size` is the current byte total.
 */
export function trimScrollback(chunks: string[], size: number, limit: number): number {
  let total = size;
  while (total > limit && chunks.length > 0) {
    const first = chunks[0] ?? "";
    const firstBytes = utf8Length(first);
    const excess = total - limit;
    if (firstBytes <= excess) {
      chunks.shift();
      total -= firstBytes;
      continue;
    }
    const bytes = Buffer.from(first, "utf8");
    let cut = excess;
    while (isContinuationByte(bytes[cut])) cut += 1;
    const newline = bytes.indexOf(NEWLINE, cut);
    if (newline !== -1 && newline - cut < LINE_SEARCH_BYTES) cut = newline + 1;
    chunks[0] = bytes.subarray(cut).toString("utf8");
    total -= cut;
  }
  return total;
}

export class TerminalService {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly config: Config,
    private readonly repos: Repositories,
    private readonly hub: EventHub,
    private readonly logger: Logger,
    private readonly scrollbackLimit: number = LIMITS.terminalScrollbackBytes,
    private readonly stopGraceMs: number = LIMITS.processStopGraceMs,
  ) {}

  create(input: CreateTerminal): TerminalInfo {
    let cwd = this.config.workspace;
    let projectId: string | null = null;
    if (input.projectId !== undefined) {
      const location = locateProject(this.config.projectsDir, input.projectId);
      if (!location.exists) throw notFound(`Project ${location.id} not found`);
      cwd = location.path;
      projectId = location.id;
    }

    let argv = this.config.shell;
    if (input.kind === "claude") {
      const claude = resolveExecutable(this.config.claudeBin);
      if (!claude) throw unavailable(`Claude Code (${this.config.claudeBin}) is not installed in this sandbox`);
      argv = [claude];
    }

    const info: TerminalInfo = {
      id: createId("terminal"),
      kind: input.kind,
      projectId,
      title: `${input.kind === "claude" ? "Claude" : "Shell"} · ${projectId ?? "workspace"}`,
      cwd,
      pid: null,
      cols: input.cols,
      rows: input.rows,
      state: "running",
      exitCode: null,
      createdAt: nowIso(),
    };

    const decoder = new TextDecoder();
    let session: Session | undefined;
    let reachedEof: () => void = () => {};
    const eof = new Promise<void>((resolve) => {
      reachedEof = resolve;
    });
    let proc: Bun.Subprocess;
    try {
      proc = Bun.spawn(argv, {
        cwd,
        env: {
          ...childEnv(),
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          LANG: process.env.LANG ?? "C.UTF-8",
          THEONE_TERMINAL_ID: info.id,
        },
        terminal: {
          cols: input.cols,
          rows: input.rows,
          name: "xterm-256color",
          data: (_terminal, bytes) => {
            if (session) this.output(session, decoder.decode(bytes, { stream: true }));
          },
          exit: () => reachedEof(),
        },
      });
    } catch (error) {
      throw unavailable(`Could not start ${argv[0]}: ${errorMessage(error)}`);
    }
    const terminal = proc.terminal;
    if (!terminal) {
      proc.kill("SIGKILL");
      throw unavailable("PTY support is not available in this Bun runtime");
    }

    info.pid = proc.pid;
    session = { info, proc, terminal, clients: new Set(), chunks: [], size: 0, closing: false, finished: Promise.resolve(info) };
    const live = session;
    live.finished = proc.exited.then(async () => {
      if (!live.closing) {
        await reapGroup(proc.pid, this.stopGraceMs, (leftovers) =>
          this.logger.info(describeLeftovers(leftovers), { id: info.id, pids: leftovers.map((leftover) => leftover.pid) }),
        );
      }
      await Promise.race([eof, Bun.sleep(EOF_GRACE_MS)]);
      const tail = decoder.decode();
      if (tail) this.output(live, tail);
      return this.finish(live);
    });
    this.sessions.set(info.id, session);
    this.commit(info);
    this.logger.info("terminal started", { id: info.id, kind: info.kind, pid: proc.pid });
    return { ...info };
  }

  private output(session: Session, data: string): void {
    if (!data) return;
    session.chunks.push(data);
    session.size = trimScrollback(session.chunks, session.size + utf8Length(data), this.scrollbackLimit);
    for (const client of session.clients) client.send({ type: "output", data });
  }

  private finish(session: Session): TerminalInfo {
    const { info, proc, terminal } = session;
    info.state = "exited";
    info.exitCode = proc.exitCode;
    try {
      terminal.close();
    } catch {}
    this.commit(info);
    for (const client of session.clients) {
      client.send({ type: "exit", code: info.exitCode });
      client.close();
    }
    session.clients.clear();
    this.evictExited();
    this.logger.info("terminal exited", { id: info.id, code: info.exitCode });
    return { ...info };
  }

  /** Replays the scrollback as one output message, then streams live output. */
  attach(id: string, client: TerminalClient): () => void {
    const session = this.sessions.get(id);
    if (!session) throw notFound(`Terminal ${id} not found`);
    const replay = session.chunks.join("");
    if (replay) client.send({ type: "output", data: replay });
    if (session.info.state === "exited") {
      client.send({ type: "exit", code: session.info.exitCode });
      client.close();
      return () => {};
    }
    session.clients.add(client);
    return () => session.clients.delete(client);
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (session && session.info.state === "running") session.terminal.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session || session.info.state !== "running") return;
    if (session.info.cols === cols && session.info.rows === rows) return;
    session.terminal.resize(cols, rows);
    session.info.cols = cols;
    session.info.rows = rows;
    this.commit(session.info);
  }

  async close(id: string): Promise<TerminalInfo> {
    const session = this.sessions.get(id);
    if (!session) {
      const stored = this.repos.terminals.get(id);
      if (!stored) throw notFound(`Terminal ${id} not found`);
      return stored;
    }
    if (session.info.state === "running") {
      session.closing = true;
      await terminateGroup(session.proc.pid, session.proc.exited, this.stopGraceMs, "SIGHUP");
    }
    const info = await session.finished;
    this.sessions.delete(id);
    return info;
  }

  list(): TerminalInfo[] {
    return [...this.sessions.values()]
      .map((session) => ({ ...session.info }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  running(): TerminalInfo[] {
    return this.list().filter((info) => info.state === "running");
  }

  runningCount(): number {
    return this.running().length;
  }

  async shutdown(): Promise<void> {
    await Promise.all(
      [...this.sessions.values()]
        .filter((session) => session.info.state === "running")
        .map((session) => {
          session.closing = true;
          return terminateGroup(session.proc.pid, session.proc.exited, 1_000, "SIGHUP");
        }),
    );
  }

  private evictExited(): void {
    const exited = [...this.sessions.values()].filter((session) => session.info.state === "exited");
    for (const session of exited.slice(0, Math.max(0, exited.length - MAX_EXITED_SESSIONS))) {
      this.sessions.delete(session.info.id);
    }
  }

  private commit(info: TerminalInfo): void {
    this.repos.terminals.save(info);
    this.hub.publish({ type: "terminal.updated", terminal: { ...info } });
  }
}
