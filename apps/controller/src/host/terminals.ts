import { hostname } from "node:os";
import { createId, LIMITS, type CreateTerminal, type TerminalInfo } from "@tesseract/protocol";
import { badRequest, errorMessage, notFound, unavailable } from "../core/errors";
import type { Env } from "../core/exec";
import type { Logger } from "../core/logger";
import { reapGroup, terminateGroup } from "../core/process-group";
import { nowIso } from "../core/time";
import { trimScrollback, type TerminalClient } from "../services/terminals";

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
const HOST_SECRET_ENV = /^TESSERACT_HOST_SHELL_/;

export function hostShellEnv(source: Env = process.env): Env {
  const env: Env = {};
  for (const [name, value] of Object.entries(source)) if (!HOST_SECRET_ENV.test(name)) env[name] = value;
  return env;
}

export class HostTerminals {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly shell: string[],
    private readonly cwd: string,
    private readonly logger: Logger,
    private readonly scrollbackLimit: number = LIMITS.terminalScrollbackBytes,
    private readonly stopGraceMs: number = LIMITS.processStopGraceMs,
  ) {}

  create(input: CreateTerminal): TerminalInfo {
    if (input.kind !== "shell") throw badRequest("The host shell only opens shell terminals");
    if (input.projectId !== undefined) throw badRequest("Host terminals have no project");
    const info: TerminalInfo = {
      id: createId("terminal"),
      kind: "shell",
      projectId: null,
      title: `Host · ${hostname()}`,
      cwd: this.cwd,
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
      proc = Bun.spawn(this.shell, {
        cwd: this.cwd,
        env: { ...hostShellEnv(), TERM: "xterm-256color", COLORTERM: "truecolor", LANG: process.env.LANG ?? "C.UTF-8" },
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
      throw unavailable(`Could not start ${this.shell[0]}: ${errorMessage(error)}`);
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
      if (!live.closing) await reapGroup(proc.pid, this.stopGraceMs, () => {});
      await Promise.race([eof, Bun.sleep(EOF_GRACE_MS)]);
      const tail = decoder.decode();
      if (tail) this.output(live, tail);
      return this.finish(live);
    });
    this.sessions.set(info.id, session);
    this.logger.info("host terminal started", { id: info.id, pid: proc.pid });
    return { ...info };
  }

  private output(session: Session, data: string): void {
    if (!data) return;
    session.chunks.push(data);
    session.size = trimScrollback(session.chunks, session.size + Buffer.byteLength(data, "utf8"), this.scrollbackLimit);
    for (const client of session.clients) client.send({ type: "output", data });
  }

  private finish(session: Session): TerminalInfo {
    const { info, proc, terminal } = session;
    info.state = "exited";
    info.exitCode = proc.exitCode;
    try {
      terminal.close();
    } catch {}
    for (const client of session.clients) {
      client.send({ type: "exit", code: info.exitCode });
      client.close();
    }
    session.clients.clear();
    const exited = [...this.sessions.values()].filter((entry) => entry.info.state === "exited");
    for (const entry of exited.slice(0, Math.max(0, exited.length - MAX_EXITED_SESSIONS))) this.sessions.delete(entry.info.id);
    this.logger.info("host terminal exited", { id: info.id, code: info.exitCode });
    return { ...info };
  }

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
    session.terminal.resize(cols, rows);
    session.info.cols = cols;
    session.info.rows = rows;
  }

  async close(id: string): Promise<TerminalInfo> {
    const session = this.sessions.get(id);
    if (!session) throw notFound(`Terminal ${id} not found`);
    if (session.info.state === "running") {
      session.closing = true;
      await terminateGroup(session.proc.pid, session.proc.exited, this.stopGraceMs, "SIGHUP");
    }
    const info = await session.finished;
    this.sessions.delete(id);
    return info;
  }

  list(): TerminalInfo[] {
    return [...this.sessions.values()].map((session) => ({ ...session.info })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
}
