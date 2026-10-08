import {
  createId,
  LIMITS,
  type LogLine,
  type LogStream,
  type ProcessCommand,
  type ProcessInfo,
  type StartProcess,
} from "@tesseract/protocol";
import { conflict, errorMessage, notFound } from "../core/errors";
import { childEnv } from "../core/exec";
import { LineSplitter } from "../core/line-splitter";
import { probeTcp } from "../core/net";
import { locateProject } from "../core/paths";
import { findPortOwner } from "../core/ports";
import { describeLeftovers, reapGroup, terminateGroup } from "../core/process-group";
import { nowIso } from "../core/time";
import type { EventHub } from "../core/events";
import type { LogChannel, LogStore } from "../core/log-store";
import type { Logger } from "../core/logger";
import type { Repositories } from "../db/repositories";
import type { Config } from "../config";

export type SpawnSpec = {
  projectId: string | null;
  name: string;
  command: ProcessCommand;
  cwd: string;
  env?: Record<string, string>;
  display?: boolean;
  port?: number | null;
  /** Keep stdin open as a pipe (see `ProcessService.write`); the default is no stdin. */
  stdin?: "pipe";
  /** Rewrites each output line before it is logged; null drops the line. */
  transformLine?: LineTransform;
  onExit?: (info: ProcessInfo) => void;
};

export type LineTransform = (stream: "stdout" | "stderr", line: string) => string | null;

type LiveProcess = {
  info: ProcessInfo;
  proc: Bun.Subprocess<"ignore" | "pipe", "pipe", "pipe">;
  channel: LogChannel;
  stopRequested: boolean;
  stopping: Promise<void> | null;
  finished: Promise<ProcessInfo>;
};

const READER_GRACE_MS = 500;
const PORT_PROBE_TIMEOUT_MS = 500;
const NAME_LENGTH = 60;
/**
 * Extra env for processes on the sandbox display. The sandbox can't run Chromium's setuid sandbox (synced
 * `chrome-sandbox` isn't root-owned 4755), so Electron aborts at startup unless its sandbox is disabled.
 */
const DISPLAY_ENV: Record<string, string> = { ELECTRON_DISABLE_SANDBOX: "1" };

export function commandArgv(command: ProcessCommand): string[] {
  return typeof command === "string" ? ["bash", "-lc", command] : command;
}

export function describeCommand(command: ProcessCommand): string {
  return typeof command === "string" ? command : command.map((part) => (/^[\w./:=@-]+$/.test(part) ? part : JSON.stringify(part))).join(" ");
}

function defaultName(command: ProcessCommand): string {
  const text = describeCommand(command).replace(/\s+/g, " ").trim();
  return text.length > NAME_LENGTH ? `${text.slice(0, NAME_LENGTH - 1)}…` : text;
}

export async function pumpLines(
  stream: ReadableStream<Uint8Array>,
  channel: LogChannel,
  name: "stdout" | "stderr",
  transform?: LineTransform,
): Promise<void> {
  const reader = stream.getReader();
  const splitter = new LineSplitter();
  const emit = (lines: string[]) => {
    for (const line of lines) {
      if (channel.ended) return;
      const text = transform ? transform(name, line) : line;
      if (text !== null) channel.append(name, text);
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (channel.ended) {
        await reader.cancel();
        return;
      }
      emit(splitter.push(value));
    }
    emit(splitter.flush());
  } catch {
    emit(splitter.flush());
  }
}

export class ProcessService {
  private readonly live = new Map<string, LiveProcess>();

  constructor(
    private readonly config: Config,
    private readonly repos: Repositories,
    private readonly logs: LogStore,
    private readonly hub: EventHub,
    private readonly logger: Logger,
    private readonly stopGraceMs: number = LIMITS.processStopGraceMs,
  ) {}

  async start(input: StartProcess): Promise<ProcessInfo> {
    const location = locateProject(this.config.projectsDir, input.projectId);
    if (!location.exists) throw notFound(`Project ${location.id} not found`);
    if (input.port !== undefined) await this.assertPortFree(input.port);
    return this.spawn({
      projectId: location.id,
      name: input.name ?? defaultName(input.command),
      command: input.command,
      cwd: location.path,
      env: input.env,
      display: input.display,
      port: input.port ?? null,
    });
  }

  spawn(spec: SpawnSpec): ProcessInfo {
    const info: ProcessInfo = {
      id: createId("process"),
      projectId: spec.projectId,
      name: spec.name,
      command: spec.command,
      cwd: spec.cwd,
      pid: null,
      port: spec.port ?? null,
      display: spec.display === true,
      state: "starting",
      exitCode: null,
      startedAt: nowIso(),
      endedAt: null,
    };
    const channel = this.logs.open(info.id);
    channel.append("system", `$ ${describeCommand(spec.command)}`);

    let proc: LiveProcess["proc"];
    try {
      proc = Bun.spawn(commandArgv(spec.command), {
        cwd: spec.cwd,
        env: {
          ...childEnv(),
          ...(spec.display ? DISPLAY_ENV : {}),
          ...spec.env,
          ...(spec.display ? { DISPLAY: this.config.display } : {}),
          TESSERACT_PROCESS_ID: info.id,
        },
        stdin: spec.stdin ?? "ignore",
        stdout: "pipe",
        stderr: "pipe",
        detached: true,
      });
    } catch (error) {
      info.state = "failed";
      info.endedAt = nowIso();
      channel.append("system", `Failed to start: ${errorMessage(error)}`);
      channel.end(null);
      this.commit(info);
      spec.onExit?.({ ...info });
      return { ...info };
    }

    info.pid = proc.pid;
    info.state = "running";
    this.commit(info);
    this.logger.info("process started", { id: info.id, project: info.projectId ?? undefined, pid: proc.pid });

    const readers = Promise.all([
      pumpLines(proc.stdout, channel, "stdout", spec.transformLine),
      pumpLines(proc.stderr, channel, "stderr", spec.transformLine),
    ]);
    const entry: LiveProcess = { info, proc, channel, stopRequested: false, stopping: null, finished: Promise.resolve(info) };
    entry.finished = this.watch(entry, readers, spec.onExit);
    this.live.set(info.id, entry);
    return { ...info };
  }

  private async watch(entry: LiveProcess, readers: Promise<unknown>, onExit?: SpawnSpec["onExit"]): Promise<ProcessInfo> {
    await entry.proc.exited;
    const stdin = entry.proc.stdin;
    if (stdin && typeof stdin !== "number") void Promise.resolve().then(() => stdin.end()).catch(() => {});
    if (entry.stopping) await entry.stopping;
    else await reapGroup(entry.proc.pid, this.stopGraceMs, (leftovers) => entry.channel.append("system", describeLeftovers(leftovers)));
    await Promise.race([readers, Bun.sleep(READER_GRACE_MS)]);
    const { info, proc, channel } = entry;
    const code = proc.exitCode;
    info.exitCode = code;
    info.endedAt = nowIso();
    info.state = entry.stopRequested ? "stopped" : code === 0 ? "exited" : "failed";
    channel.append(
      "system",
      entry.stopRequested
        ? "Process stopped"
        : proc.signalCode
          ? `Process killed by ${proc.signalCode}`
          : `Process exited with code ${code}`,
    );
    channel.end(code);
    this.live.delete(info.id);
    this.commit(info);
    this.logger.info("process ended", { id: info.id, state: info.state, code });
    onExit?.({ ...info });
    return { ...info };
  }

  async stop(id: string): Promise<ProcessInfo> {
    const entry = this.live.get(id);
    if (!entry) return this.get(id);
    if (!entry.stopRequested) entry.channel.append("system", "Stopping: SIGTERM to the process group");
    await this.terminate(entry, this.stopGraceMs);
    return entry.finished;
  }

  /** Writes to the stdin pipe of a live process spawned with `stdin: "pipe"`; false when that is not possible. */
  write(id: string, data: string): boolean {
    const stdin = this.live.get(id)?.proc.stdin;
    if (!stdin || typeof stdin === "number") return false;
    try {
      stdin.write(data);
      void Promise.resolve(stdin.flush()).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  private terminate(entry: LiveProcess, graceMs: number): Promise<void> {
    entry.stopRequested = true;
    entry.stopping ??= terminateGroup(entry.proc.pid, entry.proc.exited, graceMs);
    return entry.stopping;
  }

  get(id: string): ProcessInfo {
    const live = this.live.get(id);
    if (live) return { ...live.info };
    const stored = this.repos.processes.get(id);
    if (!stored) throw notFound(`Process ${id} not found`);
    return stored;
  }

  list(projectId?: string): ProcessInfo[] {
    return this.repos.processes.list({ projectId });
  }

  logTail(id: string, tail: number): LogLine[] {
    this.get(id);
    return this.logs.tail(id, tail);
  }

  running(): ProcessInfo[] {
    return [...this.live.values()].map((entry) => ({ ...entry.info }));
  }

  runningCount(): number {
    return this.live.size;
  }

  /** The live process whose group or session (children are spawned detached, so both equal its pid) contains `member`. */
  ownerOf(member: { pgid: number; session: number }): ProcessInfo | null {
    for (const entry of this.live.values()) {
      if (entry.proc.pid === member.pgid || entry.proc.pid === member.session) return { ...entry.info };
    }
    return null;
  }

  async shutdown(graceMs = this.stopGraceMs): Promise<void> {
    await Promise.all(
      [...this.live.values()].map(async (entry) => {
        await this.terminate(entry, graceMs);
        await Promise.race([entry.finished, Bun.sleep(READER_GRACE_MS * 2)]);
      }),
    );
  }

  /** Throws 409 when a live process claims the port or something accepts connections on it. */
  async assertPortFree(port: number): Promise<void> {
    const owner = [...this.live.values()].find((entry) => entry.info.port === port);
    if (owner) throw conflict(`Port ${port} is already used by process ${owner.info.id} (${owner.info.name})`);
    const [v4, v6] = await Promise.all([
      probeTcp("127.0.0.1", port, PORT_PROBE_TIMEOUT_MS),
      probeTcp("::1", port, PORT_PROBE_TIMEOUT_MS),
    ]);
    if (!v4 && !v6) return;
    const holder = findPortOwner(port);
    const tracked = holder ? this.ownerOf(holder) : null;
    if (tracked) throw conflict(`Port ${port} is already in use by process ${tracked.id} (${tracked.name})`);
    if (holder) throw conflict(`Port ${port} is already in use by pid ${holder.pid} (${holder.command})`);
    throw conflict(`Port ${port} is already in use`);
  }

  private commit(info: ProcessInfo): void {
    this.repos.processes.save(info);
    this.hub.publish({ type: "process.updated", process: { ...info } });
  }
}
