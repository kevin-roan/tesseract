import {
  isFinalAppRunState,
  isFinalProcessState,
  isIdOfKind,
  LIMITS,
  type AgentRun,
  type AppRun,
  type ProcessInfo,
  type RuntimeEntry,
  type RuntimeKind,
  type StopSignal,
  type TerminalInfo,
} from "@tesseract/protocol";
import { errorMessage, notFound } from "../core/errors";
import { run } from "../core/exec";
import {
  CLOCK_TICKS_PER_SECOND,
  listPids,
  PAGE_BYTES,
  readProcCmdline,
  readProcSample,
  readUptimeSeconds,
  type ProcSample,
} from "../core/proc";
import type { Logger } from "../core/logger";
import type { Config } from "../config";
import type { AgentRunService } from "./agent-runs";
import { RUN_TARGET_LABELS, type AppRunService } from "./app-runs";
import { describeCommand, type ProcessService } from "./processes";
import type { TerminalService } from "./terminals";
import type { VncSession, VncSessionRegistry } from "./vnc-bridge";

export type ProcSource = {
  /** Every live process, or null without procfs. */
  samples(): ProcSample[] | null;
  sample(pid: number): ProcSample | null;
  cmdline(pid: number): string[] | null;
  uptimeSeconds(): number | null;
};

export type SupervisorProgram = { state: string; pid: number | null };

export type SupervisorControl = {
  /** Null when supervisord is not reachable or does not know the program. */
  status(program: string): Promise<SupervisorProgram | null>;
  /** `supervisorctl stop`: SIGTERM, then supervisord's own SIGKILL after `stopwaitsecs`; the program stays stopped. */
  stop(program: string): Promise<boolean>;
};

export type SandboxRuntimeOptions = {
  proc?: ProcSource;
  supervisor?: SupervisorControl;
  kill?: (pid: number, signal: NodeJS.Signals) => boolean;
  /** CDP `Browser.close` against the DevTools port; false when that did not work. */
  closeBrowser?: (port: number) => Promise<boolean>;
  stopGraceMs?: number;
  killWaitMs?: number;
  pollMs?: number;
  now?: () => number;
};

const XVNC_PROGRAM = "xvnc";
const XVNC_ID = "xvnc";
const XVNC_COMMAND = "Xvnc";
const SUPERVISOR_COMMAND = "supervisord";
const CHROMIUM_COMMAND = /^(chromium|chromium-browse|chrome)$/;
const DEFUNCT_STATES = new Set(["Z", "X"]);
const KILL_WAIT_MS = 2_000;
const POLL_MS = 50;
const SUPERVISOR_STATUS_TIMEOUT_MS = 5_000;
const SUPERVISOR_STOP_TIMEOUT_MS = 30_000;
const CDP_TIMEOUT_MS = 2_000;
const PROMPT_LENGTH = 80;

export const procfsSource: ProcSource = {
  samples: () => {
    const pids = listPids();
    if (!pids) return null;
    return pids.map(readProcSample).filter((sample): sample is ProcSample => sample !== null && !DEFUNCT_STATES.has(sample.state));
  },
  sample: readProcSample,
  cmdline: readProcCmdline,
  uptimeSeconds: readUptimeSeconds,
};

export const supervisorctl: SupervisorControl = {
  async status(program) {
    const result = await run(["supervisorctl", "status", program], { timeoutMs: SUPERVISOR_STATUS_TIMEOUT_MS });
    return parseSupervisorStatus(result.stdout, program);
  },
  async stop(program) {
    const result = await run(["supervisorctl", "stop", program], { timeoutMs: SUPERVISOR_STOP_TIMEOUT_MS });
    return result.ok || /not running/i.test(result.stdout);
  },
};

/** One `supervisorctl status <program>` line: `xvnc  RUNNING   pid 42, uptime 1:02:03`. */
export function parseSupervisorStatus(output: string, program: string): SupervisorProgram | null {
  for (const line of output.split("\n")) {
    const match = /^(\S+)\s+([A-Z]+)\b(?:\s+pid (\d+))?/.exec(line.trim());
    if (match && match[1] === program) return { state: match[2]!.toLowerCase(), pid: match[3] ? Number(match[3]) : null };
  }
  return null;
}

/** Closes Chromium through its DevTools endpoint, as the window's close button would (profile and session saved). */
export async function closeBrowserViaCdp(port: number): Promise<boolean> {
  let url: string;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(CDP_TIMEOUT_MS) });
    const body = (await response.json()) as { webSocketDebuggerUrl?: unknown };
    if (typeof body.webSocketDebuggerUrl !== "string") return false;
    url = body.webSocketDebuggerUrl;
  } catch {
    return false;
  }
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {}
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), CDP_TIMEOUT_MS);
    const socket = new WebSocket(url);
    socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: "Browser.close" }));
    socket.onmessage = () => finish(true);
    socket.onclose = () => finish(true);
    socket.onerror = () => finish(false);
  });
}

function defaultKill(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

function truncate(text: string, length: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}

type Usage = Pick<RuntimeEntry, "cpuPercent" | "memoryBytes">;
const NO_USAGE: Usage = { cpuPercent: null, memoryBytes: null };

/** One /proc scan: groups, trees and CPU/memory of the processes behind each entry. */
class ProcSnapshot {
  private readonly byPid = new Map<number, ProcSample>();
  private readonly children = new Map<number, number[]>();

  constructor(
    readonly samples: ProcSample[] | null,
    private readonly uptime: number | null,
    private readonly previous: Map<number, { ticks: number; at: number }>,
    private readonly now: number,
  ) {
    for (const sample of samples ?? []) {
      this.byPid.set(sample.pid, sample);
      this.children.set(sample.ppid, [...(this.children.get(sample.ppid) ?? []), sample.pid]);
    }
  }

  get(pid: number): ProcSample | null {
    return this.byPid.get(pid) ?? null;
  }

  /** The leader's process group and session (children are spawned detached: pid = pgid = sid). */
  group(leader: number): number[] {
    return (this.samples ?? []).filter((sample) => sample.pgrp === leader || sample.session === leader).map((sample) => sample.pid);
  }

  tree(root: number): number[] {
    if (!this.byPid.has(root)) return [];
    const tree: number[] = [];
    const pending = [root];
    while (pending.length > 0) {
      const pid = pending.pop()!;
      tree.push(pid);
      pending.push(...(this.children.get(pid) ?? []));
    }
    return tree;
  }

  startedAt(pid: number): string | null {
    const sample = this.byPid.get(pid);
    if (!sample || this.uptime === null) return null;
    const bootMs = this.now - this.uptime * 1000;
    return new Date(bootMs + (sample.startTicks / CLOCK_TICKS_PER_SECOND) * 1000).toISOString();
  }

  /** CPU since the previous listing (since start on the first one), summed over `pids`; memory = summed RSS. */
  usage(pids: number[]): Usage {
    const live = pids.map((pid) => this.byPid.get(pid)).filter((sample): sample is ProcSample => sample !== undefined);
    if (live.length === 0) return NO_USAGE;
    let cpu = 0;
    let cpuKnown = false;
    for (const sample of live) {
      const before = this.previous.get(sample.pid);
      const seconds = before ? (this.now - before.at) / 1000 : this.uptime === null ? 0 : this.uptime - sample.startTicks / CLOCK_TICKS_PER_SECOND;
      const ticks = before ? sample.cpuTicks - before.ticks : sample.cpuTicks;
      if (seconds > 0 && ticks >= 0) {
        cpu += (ticks / CLOCK_TICKS_PER_SECOND / seconds) * 100;
        cpuKnown = true;
      }
    }
    return {
      cpuPercent: cpuKnown ? Math.round(cpu * 10) / 10 : null,
      memoryBytes: live.reduce((total, sample) => total + sample.rssPages * PAGE_BYTES, 0),
    };
  }
}

/**
 * Everything stoppable in the sandbox for the desktop Processes page (`GET /v1/runtime`): managed processes, app runs,
 * agent runs, terminals, Chromium on the display, Xvnc and the open VNC bridge sessions.
 */
export class SandboxRuntimeService {
  private readonly proc: ProcSource;
  private readonly supervisor: SupervisorControl;
  private readonly kill: (pid: number, signal: NodeJS.Signals) => boolean;
  private readonly closeBrowser: (port: number) => Promise<boolean>;
  private readonly stopGraceMs: number;
  private readonly killWaitMs: number;
  private readonly pollMs: number;
  private readonly now: () => number;
  private previous = new Map<number, { ticks: number; at: number }>();

  constructor(
    private readonly config: Config,
    private readonly deps: {
      processes: ProcessService;
      appRuns: AppRunService;
      agentRuns: AgentRunService;
      terminals: TerminalService;
      vncSessions: VncSessionRegistry;
    },
    private readonly logger: Logger,
    options: SandboxRuntimeOptions = {},
  ) {
    this.proc = options.proc ?? procfsSource;
    this.supervisor = options.supervisor ?? supervisorctl;
    this.kill = options.kill ?? defaultKill;
    this.closeBrowser = options.closeBrowser ?? closeBrowserViaCdp;
    this.stopGraceMs = options.stopGraceMs ?? LIMITS.processStopGraceMs;
    this.killWaitMs = options.killWaitMs ?? KILL_WAIT_MS;
    this.pollMs = options.pollMs ?? POLL_MS;
    this.now = options.now ?? Date.now;
  }

  async list(): Promise<RuntimeEntry[]> {
    const snapshot = this.snapshot();
    const entries = [
      ...this.deps.processes.running().map((info) => this.processEntry(info, snapshot)),
      ...this.deps.appRuns
        .list()
        .filter((appRun) => !isFinalAppRunState(appRun.state))
        .map((appRun) => this.appRunEntry(appRun, snapshot)),
      ...this.deps.agentRuns.running().map((agentRun) => this.agentRunEntry(agentRun, snapshot)),
      ...this.deps.terminals.running().map((terminal) => this.terminalEntry(terminal, snapshot)),
      ...this.browserEntries(snapshot),
      ...(await this.xvncEntries(snapshot)),
      ...this.deps.vncSessions.list().map(sessionEntry),
    ];
    this.remember(snapshot);
    return entries;
  }

  /** 404 when the entry is unknown (or, for browser and vnc, no longer running). */
  async stop(kind: RuntimeKind, id: string, signal: StopSignal): Promise<RuntimeEntry> {
    const killed = signal === "SIGKILL";
    switch (kind) {
      case "process": {
        if (!isIdOfKind("process", id)) throw notFound(`Process ${id.slice(0, 80)} not found`);
        const info = await this.deps.processes.stop(id, signal);
        return withState(this.processEntry(info, this.snapshot()), killed && info.state === "stopped" ? "killed" : info.state);
      }
      case "app-run": {
        if (!isIdOfKind("appRun", id)) throw notFound(`App run ${id.slice(0, 80)} not found`);
        const appRun = await this.deps.appRuns.stop(id, signal);
        return withState(this.appRunEntry(appRun, this.snapshot()), killed && appRun.state === "stopped" ? "killed" : appRun.state);
      }
      case "agent-run": {
        if (!isIdOfKind("agentRun", id)) throw notFound(`Agent run ${id.slice(0, 80)} not found`);
        const agentRun = await this.deps.agentRuns.cancel(id, signal);
        return withState(this.agentRunEntry(agentRun, this.snapshot()), killed && agentRun.state === "cancelled" ? "killed" : agentRun.state);
      }
      case "terminal": {
        if (!isIdOfKind("terminal", id)) throw notFound(`Terminal ${id.slice(0, 80)} not found`);
        const terminal = await this.deps.terminals.close(id, signal);
        return withState(this.terminalEntry(terminal, this.snapshot()), killed && terminal.state === "exited" ? "killed" : terminal.state);
      }
      case "browser":
        return this.stopBrowser(id, signal);
      case "vnc":
        return id === XVNC_ID ? this.stopXvnc(signal) : this.stopSession(id, signal);
    }
  }

  private snapshot(): ProcSnapshot {
    return new ProcSnapshot(this.proc.samples(), this.proc.uptimeSeconds(), this.previous, this.now());
  }

  private remember(snapshot: ProcSnapshot): void {
    const at = this.now();
    this.previous = new Map((snapshot.samples ?? []).map((sample) => [sample.pid, { ticks: sample.cpuTicks, at }]));
  }

  private processEntry(info: ProcessInfo, snapshot: ProcSnapshot): RuntimeEntry {
    const final = isFinalProcessState(info.state);
    const command = describeCommand(info.command);
    return {
      kind: "process",
      id: info.id,
      name: info.name,
      detail: info.port === null ? command : `${command} · port ${info.port}`,
      pid: info.pid,
      projectId: info.projectId,
      startedAt: info.startedAt,
      state: info.state,
      ...(final || info.pid === null ? NO_USAGE : snapshot.usage(snapshot.group(info.pid))),
      supervised: false,
      canStop: !final,
    };
  }

  private appRunEntry(appRun: AppRun, snapshot: ProcSnapshot): RuntimeEntry {
    const final = isFinalAppRunState(appRun.state);
    const pids = appRun.processIds.map((id) => this.processPid(id)).filter((pid): pid is number => pid !== null);
    const label = RUN_TARGET_LABELS[appRun.target];
    const parts = [appRun.port === null ? null : `port ${appRun.port}`, `${appRun.processIds.length} process${appRun.processIds.length === 1 ? "" : "es"}`];
    return {
      kind: "app-run",
      id: appRun.id,
      name: appRun.dir ? `${label} · ${appRun.dir}` : label,
      detail: appRun.error ?? parts.filter(Boolean).join(" · "),
      pid: pids[0] ?? null,
      projectId: appRun.projectId,
      startedAt: appRun.startedAt,
      state: appRun.state,
      ...(final ? NO_USAGE : snapshot.usage(pids.flatMap((pid) => snapshot.group(pid)))),
      supervised: false,
      canStop: !final,
    };
  }

  private agentRunEntry(agentRun: AgentRun, snapshot: ProcSnapshot): RuntimeEntry {
    const pid = this.deps.agentRuns.pidOf(agentRun.id);
    const running = agentRun.state === "running";
    return {
      kind: "agent-run",
      id: agentRun.id,
      name: "Claude agent run",
      detail: truncate(agentRun.prompt, PROMPT_LENGTH) || null,
      pid,
      projectId: agentRun.projectId,
      startedAt: agentRun.startedAt,
      state: agentRun.state,
      ...(running && pid !== null ? snapshot.usage(snapshot.group(pid)) : NO_USAGE),
      supervised: false,
      canStop: running,
    };
  }

  private terminalEntry(terminal: TerminalInfo, snapshot: ProcSnapshot): RuntimeEntry {
    const running = terminal.state === "running";
    return {
      kind: "terminal",
      id: terminal.id,
      name: terminal.title,
      detail: `${terminal.kind} · ${terminal.cwd}`,
      pid: terminal.pid,
      projectId: terminal.projectId,
      startedAt: terminal.createdAt,
      state: terminal.state,
      ...(running && terminal.pid !== null ? snapshot.usage(snapshot.group(terminal.pid)) : NO_USAGE),
      supervised: false,
      canStop: running,
    };
  }

  private processPid(id: string): number | null {
    try {
      return this.deps.processes.get(id).pid;
    } catch {
      return null;
    }
  }

  private supervisedBy(snapshot: ProcSnapshot, pid: number): boolean {
    const parent = snapshot.get(snapshot.get(pid)?.ppid ?? 0);
    return parent?.command === SUPERVISOR_COMMAND;
  }

  /** Chromium browser processes (not renderers/zygotes) that no managed process, app run or terminal owns. */
  private browserEntries(snapshot: ProcSnapshot): RuntimeEntry[] {
    const owned = new Set([
      ...this.deps.processes.running().map((info) => info.pid),
      ...this.deps.terminals.running().map((info) => info.pid),
      ...this.deps.agentRuns.running().map((agentRun) => this.deps.agentRuns.pidOf(agentRun.id)),
    ]);
    const entries: RuntimeEntry[] = [];
    for (const sample of snapshot.samples ?? []) {
      if (!CHROMIUM_COMMAND.test(sample.command) || owned.has(sample.pgrp) || owned.has(sample.session)) continue;
      const argv = this.proc.cmdline(sample.pid);
      if (!argv || argv.length === 0 || argv.some((arg) => arg.startsWith("--type="))) continue;
      const parent = snapshot.get(sample.ppid);
      if (parent && CHROMIUM_COMMAND.test(parent.command)) continue;
      entries.push(this.browserEntry(sample.pid, argv, snapshot));
    }
    return entries;
  }

  private browserEntry(pid: number, argv: string[], snapshot: ProcSnapshot): RuntimeEntry {
    const debugPort = this.debugPortOf(argv);
    const profile = argv.find((arg) => arg.startsWith("--user-data-dir="))?.slice("--user-data-dir=".length);
    const detail = [debugPort === null ? null : `DevTools 127.0.0.1:${debugPort}`, profile ? `profile ${profile}` : null].filter(Boolean).join(" · ");
    return {
      kind: "browser",
      id: String(pid),
      name: "Chromium",
      detail: detail || null,
      pid,
      projectId: null,
      startedAt: snapshot.startedAt(pid),
      state: "running",
      ...snapshot.usage(snapshot.tree(pid)),
      supervised: this.supervisedBy(snapshot, pid),
      canStop: true,
    };
  }

  private debugPortOf(argv: string[]): number | null {
    const flag = argv.find((arg) => arg.startsWith("--remote-debugging-port="));
    const port = flag ? Number(flag.slice("--remote-debugging-port=".length)) : NaN;
    return Number.isInteger(port) && port > 0 ? port : null;
  }

  private async xvncEntries(snapshot: ProcSnapshot): Promise<RuntimeEntry[]> {
    const sample = (snapshot.samples ?? []).find((candidate) => candidate.command === XVNC_COMMAND);
    if (sample) return [this.xvncEntry(sample.pid, "running", this.supervisedBy(snapshot, sample.pid), snapshot)];
    const program = await this.supervisor.status(XVNC_PROGRAM).catch(() => null);
    return program ? [this.xvncEntry(null, program.state, true, snapshot)] : [];
  }

  private xvncEntry(pid: number | null, state: string, supervised: boolean, snapshot: ProcSnapshot): RuntimeEntry {
    return {
      kind: "vnc",
      id: XVNC_ID,
      name: "Xvnc display server",
      detail: `display ${this.config.display} · RFB ${this.config.vncHost}:${this.config.vncPort}`,
      pid,
      projectId: null,
      startedAt: pid === null ? null : snapshot.startedAt(pid),
      state,
      ...(pid === null ? NO_USAGE : snapshot.usage([pid])),
      supervised,
      canStop: pid !== null,
    };
  }

  /** SIGTERM: CDP `Browser.close` (else SIGTERM to the browser process), SIGKILL of its tree after the grace period. */
  private async stopBrowser(id: string, signal: StopSignal): Promise<RuntimeEntry> {
    const snapshot = this.snapshot();
    const entry = this.browserEntries(snapshot).find((candidate) => candidate.id === id);
    if (!entry || entry.pid === null) throw notFound(`Browser ${id.slice(0, 80)} not found`);
    const pid = entry.pid;
    if (signal === "SIGKILL") {
      this.killTree(snapshot.tree(pid));
      return withState(entry, (await this.exits(pid, this.killWaitMs)) ? "killed" : "stopping");
    }
    const debugPort = this.debugPortOf(this.proc.cmdline(pid) ?? []);
    const closed = debugPort !== null && (await this.closeBrowser(debugPort).catch(() => false));
    if (!closed) this.kill(pid, "SIGTERM");
    if (await this.exits(pid, this.stopGraceMs)) return withState(entry, "stopped");
    this.logger.warn("browser ignored the graceful stop, killing it", { pid });
    this.killTree(this.snapshot().tree(pid));
    return withState(entry, (await this.exits(pid, this.killWaitMs)) ? "killed" : "stopping");
  }

  /**
   * SIGTERM: `supervisorctl stop xvnc` (stays stopped until `supervisorctl start xvnc` or a sandbox restart).
   * SIGKILL: kills Xvnc at once; supervisord restarts it (`autorestart=true`).
   */
  private async stopXvnc(signal: StopSignal): Promise<RuntimeEntry> {
    const snapshot = this.snapshot();
    const [entry] = await this.xvncEntries(snapshot);
    if (!entry || entry.pid === null) throw notFound("Xvnc is not running");
    const pid = entry.pid;
    if (signal === "SIGKILL") {
      this.kill(pid, "SIGKILL");
      return withState(entry, (await this.exits(pid, this.killWaitMs)) ? "killed" : "stopping");
    }
    if (entry.supervised) {
      const stopped = await this.supervisor.stop(XVNC_PROGRAM).catch((error) => {
        this.logger.warn("supervisorctl stop failed", { program: XVNC_PROGRAM, error: errorMessage(error) });
        return false;
      });
      if (stopped && (await this.exits(pid, this.killWaitMs))) return withState(entry, "stopped");
    }
    this.kill(pid, "SIGTERM");
    if (await this.exits(pid, this.stopGraceMs)) return withState(entry, "stopped");
    this.kill(pid, "SIGKILL");
    return withState(entry, (await this.exits(pid, this.killWaitMs)) ? "killed" : "stopping");
  }

  private stopSession(id: string, signal: StopSignal): RuntimeEntry {
    const session = this.deps.vncSessions.get(id);
    if (!session || !this.deps.vncSessions.close(id, signal)) throw notFound(`VNC session ${id.slice(0, 80)} not found`);
    return withState(sessionEntry(session), signal === "SIGKILL" ? "killed" : "closed");
  }

  private killTree(pids: number[]): void {
    for (const pid of pids) this.kill(pid, "SIGKILL");
  }

  private alive(pid: number): boolean {
    const sample = this.proc.sample(pid);
    return sample !== null && !DEFUNCT_STATES.has(sample.state);
  }

  private async exits(pid: number, timeoutMs: number): Promise<boolean> {
    const deadline = this.now() + timeoutMs;
    while (this.alive(pid)) {
      if (this.now() >= deadline) return false;
      await Bun.sleep(this.pollMs);
    }
    return true;
  }
}

function sessionEntry(session: VncSession): RuntimeEntry {
  return {
    kind: "vnc",
    id: session.id,
    name: "VNC session",
    detail: session.remote ? `viewer ${session.remote}` : null,
    pid: null,
    projectId: null,
    startedAt: session.startedAt,
    state: session.bridge.isClosed ? "closed" : "connected",
    cpuPercent: null,
    memoryBytes: null,
    supervised: false,
    canStop: !session.bridge.isClosed,
  };
}

function withState(entry: RuntimeEntry, state: string): RuntimeEntry {
  const ended = state !== "running" && state !== "starting" && state !== "ready" && state !== "connected" && state !== "stopping";
  return ended ? { ...entry, state, cpuPercent: null, memoryBytes: null, canStop: false } : { ...entry, state };
}
