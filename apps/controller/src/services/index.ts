import type { Database } from "bun:sqlite";
import { LIMITS } from "@theone/protocol";
import { TicketStore } from "../auth/tickets";
import { mirrorTokenToFile, resolveToken, type TokenSource } from "../auth/token";
import { ensureDirectories, localApiUrl, type Config } from "../config";
import { EventHub } from "../core/events";
import { LogStore } from "../core/log-store";
import { createLogger, type Logger } from "../core/logger";
import { realpathOrNull } from "../core/paths";
import { nowIso } from "../core/time";
import { openDatabase } from "../db/database";
import { Repositories } from "../db/repositories";
import { VERSION } from "../version";
import { AgentRunService } from "./agent-runs";
import { ArtifactService } from "./artifacts";
import { BuildService } from "./builds";
import { readAgentContext } from "./context";
import { DisplayService } from "./display";
import { GitService } from "./git";
import { ProcessService } from "./processes";
import { ProjectService } from "./projects";
import { RuntimeMirror } from "./runtime-mirror";
import { StatusService } from "./status";
import { TerminalService } from "./terminals";
import { defaultProbes, ToolService, type ToolProbe } from "./tools";

export type ServiceOptions = {
  logger?: Logger;
  ticketTtlMs?: number;
  stopGraceMs?: number;
  runtimeDebounceMs?: number;
  toolProbes?: ToolProbe[];
};

export type Services = {
  config: Config;
  logger: Logger;
  version: string;
  token: string;
  tokenSource: TokenSource;
  hub: EventHub;
  db: Database;
  repos: Repositories;
  logs: LogStore;
  tickets: TicketStore;
  tools: ToolService;
  processes: ProcessService;
  projects: ProjectService;
  terminals: TerminalService;
  artifacts: ArtifactService;
  builds: BuildService;
  display: DisplayService;
  agentRuns: AgentRunService;
  status: StatusService;
  runtime: RuntimeMirror;
  context: () => ReturnType<typeof readAgentContext>;
  close: () => Promise<void>;
};

export function createServices(config: Config, options: ServiceOptions = {}): Services {
  const logger = options.logger ?? createLogger(config.logLevel);
  ensureDirectories(config);
  const resolved = resolveToken(config, { create: true });
  if (!resolved) throw new Error("No controller token available");
  if (resolved.source === "generated") logger.info("generated a new API token", { file: config.tokenFile });
  if (resolved.source === "env") {
    try {
      if (mirrorTokenToFile(config, resolved.token)) logger.info("stored THEONE_TOKEN in the token file", { file: config.tokenFile });
    } catch (error) {
      logger.warn("could not store THEONE_TOKEN in the token file; in-sandbox CLI calls need it", { file: config.tokenFile, error });
    }
  }

  const db = openDatabase(config.dbPath);
  const repos = new Repositories(db);
  const recovered = repos.recoverAfterRestart(nowIso());
  if (recovered.processes + recovered.terminals + recovered.builds + recovered.agentRuns > 0) {
    logger.info("marked work from the previous run as ended", recovered);
  }

  const stopGraceMs = options.stopGraceMs ?? LIMITS.processStopGraceMs;
  const hub = new EventHub(logger.child("events"));
  const logs = new LogStore(config.logsDir, logger.child("logs"));
  const tools = new ToolService(options.toolProbes ?? defaultProbes(config.claudeBin));
  const git = new GitService(realpathOrNull(config.projectsDir) ?? config.projectsDir);
  const processes = new ProcessService(config, repos, logs, hub, logger.child("processes"), stopGraceMs);
  const projects = new ProjectService(config, git, hub, processes, logger.child("projects"));
  const terminals = new TerminalService(config, repos, hub, logger.child("terminals"), LIMITS.terminalScrollbackBytes, stopGraceMs);
  const artifacts = new ArtifactService(config, repos, hub, logger.child("artifacts"));
  const builds = new BuildService(config, repos, logs, hub, projects, artifacts, tools, logger.child("builds"), stopGraceMs);
  const display = new DisplayService(config);
  const agentRuns = new AgentRunService(config, repos, hub, logger.child("agent"), stopGraceMs);
  const status = new StatusService(config, VERSION, tools, display, () => ({
    projects: projects.count(),
    runningProcesses: processes.runningCount(),
    activeBuilds: builds.activeCount(),
    terminals: terminals.runningCount(),
    agentRuns: agentRuns.runningCount(),
  }));
  const runtime = new RuntimeMirror(
    config,
    { version: VERSION, apiUrl: localApiUrl(config), repos, processes, terminals, builds, agentRuns, display },
    logger.child("runtime"),
    options.runtimeDebounceMs,
  );
  runtime.start(hub);

  let closing: Promise<void> | null = null;
  const close = () => {
    closing ??= (async () => {
      await Promise.allSettled([builds.shutdown(), processes.shutdown(), terminals.shutdown(), agentRuns.shutdown()]);
      await runtime.stop();
      logs.flushAll();
      db.close();
    })();
    return closing;
  };

  return {
    config,
    logger,
    version: VERSION,
    token: resolved.token,
    tokenSource: resolved.source,
    hub,
    db,
    repos,
    logs,
    tickets: new TicketStore(options.ticketTtlMs),
    tools,
    processes,
    projects,
    terminals,
    artifacts,
    builds,
    display,
    agentRuns,
    status,
    runtime,
    context: () => readAgentContext(config.agentDir),
    close,
  };
}
