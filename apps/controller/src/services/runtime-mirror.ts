import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  isFinalBuildState,
  isFinalProcessState,
  type AgentRun,
  type BuildJob,
  type DisplayStatus,
  type ProcessInfo,
  type ServerEventType,
  type TerminalInfo,
} from "@theone/protocol";
import type { EventHub } from "../core/events";
import type { Logger } from "../core/logger";
import type { Repositories } from "../db/repositories";
import type { Config } from "../config";
import type { AgentRunService } from "./agent-runs";
import type { BuildService } from "./builds";
import type { DisplayService } from "./display";
import { describeCommand, type ProcessService } from "./processes";
import type { TerminalService } from "./terminals";

export type RuntimeSnapshot = {
  generatedAt: string;
  version: string;
  sandboxId: string;
  apiUrl: string;
  display: DisplayStatus;
  running: ProcessInfo[];
  ended: ProcessInfo[];
  terminals: TerminalInfo[];
  activeBuilds: BuildJob[];
  recentBuilds: BuildJob[];
  runs: AgentRun[];
};

const WATCHED: readonly ServerEventType[] = ["process.updated", "terminal.updated", "build.updated", "agent.updated", "artifact.created"];
const RECENT_PROCESSES = 10;
const RECENT_BUILDS = 5;
const RECENT_RUNS = 5;

const cell = (value: unknown) => (value === null || value === undefined || value === "" ? "–" : String(value).replace(/\|/g, "\\|").replace(/\s+/g, " "));
const row = (values: unknown[]) => `| ${values.map(cell).join(" | ")} |`;

function table(headers: string[], rows: unknown[][]): string[] {
  if (rows.length === 0) return ["_None._"];
  return [row(headers), `|${headers.map(() => "---").join("|")}|`, ...rows.map(row)];
}

export function renderRuntime(snapshot: RuntimeSnapshot): string {
  const { display } = snapshot;
  const size = display.width && display.height ? ` (${display.width}x${display.height})` : "";
  const lines = [
    "# Runtime state",
    "",
    "Written by theone-controller on every change. Read-only: edits are overwritten.",
    `Updated ${snapshot.generatedAt} · controller ${snapshot.version} · sandbox ${snapshot.sandboxId} · API ${snapshot.apiUrl}`,
    "",
    "## Display",
    "",
    `- X display ${display.display}: ${display.available ? `available${size}` : "not available"}`,
    `- VNC port ${display.vnc.port}: ${display.vnc.available ? "available" : "not available"} · web viewer ${display.webPath}`,
    "",
    `## Running processes (${snapshot.running.length})`,
    "",
    ...table(
      ["Id", "Project", "Name", "PID", "Port", "Display", "Started", "Command"],
      snapshot.running.map((p) => [p.id, p.projectId, p.name, p.pid, p.port, p.display ? "yes" : "no", p.startedAt, describeCommand(p.command)]),
    ),
    "",
    `## Terminals (${snapshot.terminals.filter((t) => t.state === "running").length} running)`,
    "",
    ...table(
      ["Id", "Kind", "Project", "PID", "Size", "State", "Created"],
      snapshot.terminals.map((t) => [t.id, t.kind, t.projectId, t.pid, `${t.cols}x${t.rows}`, t.state, t.createdAt]),
    ),
    "",
    `## Active builds (${snapshot.activeBuilds.length})`,
    "",
    ...table(
      ["Id", "Project", "Target", "Profile", "State", "Stage", "Created"],
      snapshot.activeBuilds.map((b) => [b.id, b.projectId, b.target, b.profile, b.state, b.stage, b.createdAt]),
    ),
    "",
    `## Recent builds`,
    "",
    ...table(
      ["Id", "Project", "Target", "State", "Ended", "Artifacts / error"],
      snapshot.recentBuilds.map((b) => [
        b.id,
        b.projectId,
        b.target,
        b.state,
        b.endedAt,
        b.state === "succeeded" ? b.artifacts.map((a) => a.fileName).join(", ") || "logs only" : b.error,
      ]),
    ),
    "",
    `## Agent runs`,
    "",
    ...table(
      ["Id", "Project", "State", "Session", "Started", "Ended"],
      snapshot.runs.map((r) => [r.id, r.projectId, r.state, r.sessionId, r.startedAt, r.endedAt]),
    ),
    "",
    `## Recently ended processes`,
    "",
    ...table(
      ["Id", "Project", "Name", "State", "Exit", "Ended"],
      snapshot.ended.map((p) => [p.id, p.projectId, p.name, p.state, p.exitCode, p.endedAt]),
    ),
    "",
  ];
  return lines.join("\n");
}

/** Debounced, atomic (temp file + rename) mirror of live state into `.agent/RUNTIME.md`. */
export class RuntimeMirror {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;
  private writing: Promise<void> = Promise.resolve();
  private lastDisplay = "";

  constructor(
    private readonly config: Config,
    private readonly deps: {
      version: string;
      apiUrl: string;
      repos: Repositories;
      processes: ProcessService;
      terminals: TerminalService;
      builds: BuildService;
      agentRuns: AgentRunService;
      display: DisplayService;
    },
    private readonly logger: Logger,
    private readonly debounceMs = 1_000,
    private readonly displayPollMs = 30_000,
  ) {}

  get path(): string {
    return join(this.config.agentDir, "RUNTIME.md");
  }

  start(hub: EventHub): void {
    this.unsubscribe = hub.subscribe((event) => {
      if (WATCHED.includes(event.type)) this.schedule();
    });
    this.interval = setInterval(() => void this.checkDisplay(), this.displayPollMs);
    this.schedule();
  }

  schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.writing = this.writing.then(() => this.write());
    }, this.debounceMs);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.writing = this.writing.then(() => this.write());
    }
    await this.writing;
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    if (this.interval) clearInterval(this.interval);
    await this.flush();
  }

  async snapshot(): Promise<RuntimeSnapshot> {
    const { repos, processes, terminals, builds, agentRuns, display } = this.deps;
    const recentBuilds = repos.builds
      .list({ limit: RECENT_BUILDS * 4 })
      .filter((b) => isFinalBuildState(b.state))
      .slice(0, RECENT_BUILDS)
      .map((b) => builds.get(b.id));
    const runs = [...agentRuns.running(), ...repos.agentRuns.list({ limit: RECENT_RUNS * 2 }).filter((r) => r.state !== "running")].slice(0, RECENT_RUNS);
    return {
      generatedAt: new Date().toISOString(),
      version: this.deps.version,
      sandboxId: this.config.sandboxId,
      apiUrl: this.deps.apiUrl,
      display: await display.status(),
      running: processes.running(),
      ended: repos.processes.list({ limit: RECENT_PROCESSES * 3 }).filter((p) => isFinalProcessState(p.state)).slice(0, RECENT_PROCESSES),
      terminals: terminals.list(),
      activeBuilds: builds.activeBuilds(),
      recentBuilds,
      runs,
    };
  }

  private async checkDisplay(): Promise<void> {
    try {
      const status = await this.deps.display.status();
      const key = `${status.available}:${status.width}x${status.height}:${status.vnc.available}`;
      if (key !== this.lastDisplay) this.schedule();
    } catch (error) {
      this.logger.warn("display check failed", { error });
    }
  }

  private async write(): Promise<void> {
    try {
      const snapshot = await this.snapshot();
      const d = snapshot.display;
      this.lastDisplay = `${d.available}:${d.width}x${d.height}:${d.vnc.available}`;
      const temp = join(this.config.agentDir, `.RUNTIME.md.${process.pid}.tmp`);
      writeFileSync(temp, renderRuntime(snapshot), { mode: 0o644 });
      renameSync(temp, this.path);
    } catch (error) {
      this.logger.warn("RUNTIME.md write failed", { error });
    }
  }
}
