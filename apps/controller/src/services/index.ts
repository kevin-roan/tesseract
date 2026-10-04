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
import { BrowserService } from "./browser";
import { BuildService } from "./builds";
import { ClaudeAccountService } from "./claude-accounts";
import { ClaudeAuthService } from "./claude-auth";
import { ClaudeHookService } from "./claude-hooks";
import { readAgentContext } from "./context";
import { DisplayService } from "./display";
import { GitService } from "./git";
import { IdentityService, type IdentityOptions } from "./identity";
import { InboxService } from "./inbox";
import { LiveActivityService, type LiveActivityOptions } from "./live-activity";
import { PortService } from "./ports";
import { ProcessService } from "./processes";
import { ProjectService } from "./projects";
import { PushService, type PushOptions } from "./push";
import { RuntimeMirror } from "./runtime-mirror";
import { StatusService } from "./status";
import { SyncBackService, type SyncBackOptions } from "./sync-back";
import { TaildropService, type TaildropOptions } from "./taildrop";
import { TerminalService } from "./terminals";
import { defaultProbes, ToolService, type ToolProbe } from "./tools";
import { TranscriptionService, type TranscriptionOptions } from "./transcriptions";
import { UploadService } from "./uploads";
import { UsageService } from "./usage";

export type ServiceOptions = {
  logger?: Logger;
  ticketTtlMs?: number;
  stopGraceMs?: number;
  runtimeDebounceMs?: number;
  toolProbes?: ToolProbe[];
  identity?: IdentityOptions;
  taildrop?: TaildropOptions;
  transcription?: TranscriptionOptions;
  push?: PushOptions;
  liveActivity?: LiveActivityOptions;
  syncBack?: SyncBackOptions;
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
  syncBack: SyncBackService;
  terminals: TerminalService;
  artifacts: ArtifactService;
  builds: BuildService;
  display: DisplayService;
  browser: BrowserService;
  agentRuns: AgentRunService;
  status: StatusService;
  identity: IdentityService;
  taildrop: TaildropService;
  claudeAuth: ClaudeAuthService;
  claudeAccounts: ClaudeAccountService;
  inbox: InboxService;
  push: PushService;
  liveActivity: LiveActivityService;
  claudeHooks: ClaudeHookService;
  ports: PortService;
  usage: UsageService;
  uploads: UploadService;
  transcriptions: TranscriptionService;
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
  const syncBack = new SyncBackService(config, git, repos, hub, logger.child("sync-back"), options.syncBack);
  syncBack.start();
  const claudeAccounts = new ClaudeAccountService(config, repos);
  const projects = new ProjectService(config, git, hub, processes, syncBack, repos, logger.child("projects"), (id): string[] => [
    ...processes.running().filter((process) => process.projectId === id).map((process) => `process ${process.name}`),
    ...builds.activeBuilds().filter((build) => build.projectId === id).map((build) => `build ${build.id}`),
    ...terminals.running().filter((terminal) => terminal.projectId === id).map((terminal) => `terminal ${terminal.title}`),
    ...agentRuns.running().filter((run) => run.projectId === id).map((run) => `agent run ${run.id}`),
  ]);
  const terminals = new TerminalService(config, repos, hub, projects, claudeAccounts, logger.child("terminals"), LIMITS.terminalScrollbackBytes, stopGraceMs);
  const inbox = new InboxService(repos, hub, logger.child("inbox"));
  inbox.follow(hub);
  const push = new PushService(config, repos, logger.child("push"), options.push);
  push.follow(hub);
  const artifacts = new ArtifactService(config, repos, hub, inbox, projects, logger.child("artifacts"));
  const builds = new BuildService(config, repos, logs, hub, projects, artifacts, tools, logger.child("builds"), stopGraceMs);
  const display = new DisplayService(config);
  const uploads = new UploadService(config, repos, logger.child("uploads"));
  uploads.prune();
  const transcriptions = new TranscriptionService(config, uploads, repos, hub, logger.child("stt"), options.transcription);
  const agentRuns = new AgentRunService(config, repos, hub, uploads, projects, claudeAccounts, logger.child("agent"), stopGraceMs);
  const status = new StatusService(config, VERSION, tools, display, () => ({
    projects: projects.count(),
    runningProcesses: processes.runningCount(),
    activeBuilds: builds.activeCount(),
    terminals: terminals.runningCount(),
    agentRuns: agentRuns.runningCount(),
  }));
  const identity = new IdentityService(config, logger.child("identity"), options.identity);
  const claudeAuth = new ClaudeAuthService(config, logger.child("claude-auth"));
  const taildrop = new TaildropService(config, artifacts, logger.child("taildrop"), options.taildrop);
  const claudeHooks = new ClaudeHookService(config, inbox, agentRuns, terminals, logger.child("hooks"));
  const ports = new PortService(config, processes, identity);
  const browser = new BrowserService(config, identity);
  const usage = new UsageService(config, { runs: () => [...agentRuns.list(), ...agentRuns.list({ archived: true })], terminals: () => terminals.list() });
  const liveActivity = new LiveActivityService(
    config,
    repos,
    {
      runs: () => [...agentRuns.list(), ...agentRuns.list({ archived: true })],
      processes: () => processes.running(),
      builds: () => builds.activeBuilds(),
      usage: (days) => usage.usage({ days }),
      projectName: async (id) => (await projects.get(id)).name,
      sandboxName: async () => (await identity.selfNode())?.hostName ?? null,
    },
    logger.child("live-activity"),
    options.liveActivity,
  );
  liveActivity.start(hub);
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
      syncBack.stop();
      await Promise.allSettled([builds.shutdown(), processes.shutdown(), terminals.shutdown(), agentRuns.shutdown()]);
      await runtime.stop();
      await liveActivity.stop();
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
    syncBack,
    terminals,
    artifacts,
    builds,
    display,
    browser,
    agentRuns,
    status,
    identity,
    taildrop,
    claudeAuth,
    claudeAccounts,
    inbox,
    push,
    liveActivity,
    claudeHooks,
    ports,
    usage,
    uploads,
    transcriptions,
    runtime,
    context: () => readAgentContext(config.agentDir),
    close,
  };
}
