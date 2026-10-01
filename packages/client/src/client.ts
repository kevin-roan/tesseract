import {
  AgentContextSchema,
  AgentRunBatchResultSchema,
  AgentRunDetailSchema,
  AgentRunListSchema,
  AgentRunSchema,
  AgentStreamMessageSchema,
  appendQuery,
  ArtifactListSchema,
  ArtifactSchema,
  BrowserStatusSchema,
  BuildJobSchema,
  BuildListSchema,
  ClaudeAuthStatusSchema,
  ClaudeImportResultSchema,
  ClaudeSessionListSchema,
  CreateProjectResponseSchema,
  DisplayStatusSchema,
  errorCodeForStatus,
  GitDetailsSchema,
  HealthSchema,
  IdentitySchema,
  InboxCountsSchema,
  SyncChangesSchema,
  SyncRequestListSchema,
  SyncRequestSchema,
  InboxSchema,
  PushDeviceSchema,
  LiveActivityTokenSchema,
  isErrorCode,
  ListeningPortsSchema,
  isFinalAgentRunState,
  isFinalBuildState,
  LIMITS,
  LogLineListSchema,
  LogStreamMessageSchema,
  normalizeBaseUrl,
  parseJson,
  parseJsonWith,
  PROTOCOL_VERSION,
  ProcessInfoSchema,
  ProcessListSchema,
  ProcessLogStreamMessageSchema,
  ProjectListSchema,
  ProjectSchema,
  restPaths,
  SandboxStatusSchema,
  ServerEventSchema,
  SttStatusSchema,
  TerminalInfoSchema,
  TerminalListSchema,
  TerminalServerMessageSchema,
  TICKET_PARAM,
  TaildropTargetsSchema,
  TicketSchema,
  TranscriptionSchema,
  UploadSchema,
  UsageReportSchema,
  toWebSocketUrl,
  uiPaths,
  wsPaths,
  type AgentContext,
  type CreateTranscription,
  type CreateUpload,
  type Transcription,
  type SttStatus,
  type UpdateStt,
  type Upload,
  type AgentRun,
  type AgentRunBatchResult,
  type AgentRunDetail,
  type AgentRunEvent,
  type AgentRunFilter,
  type ArchiveAgentRuns,
  type AgentStreamMessage,
  type Artifact,
  type SendArtifact,
  type ShareArtifact,
  type TaildropTargets,
  type ClaudeSession,
  type BrowserStatus,
  type BuildJob,
  type CreateProject,
  type CreateProjectResponse,
  type CreateTerminal,
  type DisplayStatus,
  type EventsClientMessage,
  type GitDetails,
  type Health,
  type ClaudeAuthStatus,
  type ClaudeImport,
  type ClaudeImportResult,
  type Identity,
  type Inbox,
  type InboxCounts,
  type InboxFilter,
  type ClaimSyncRequest,
  type CompleteSyncRequest,
  type CreateSyncRequest,
  type SyncAck,
  type SyncChanges,
  type SyncHeartbeat,
  type SyncRequest,
  type ListeningPorts,
  type LogLine,
  type LogStreamMessage,
  type LogTail,
  type DeleteAgentRuns,
  type MarkInboxRead,
  type LiveActivityToken,
  type PushDevice,
  type RegisterLiveActivity,
  type RegisterPushDevice,
  type ProcessInfo,
  type ProcessLogStreamMessage,
  type Project,
  type ProjectFilter,
  type SandboxStatus,
  type SessionsFilter,
  type Schema,
  type ServerEvent,
  type StartAgentRun,
  type StartBuild,
  type StartProcess,
  type StatusEventInput,
  type TerminalClientMessage,
  type TerminalInfo,
  type TerminalServerMessage,
  type Ticket,
  type UsageFilter,
  type UsageReport,
} from "@theone/protocol";
import { AbortError, ApiError, NetworkError, ProtocolError, ProtocolVersionError, TheOneError, TimeoutError } from "./errors";
import {
  SocketSession,
  type ConnectionHandlers,
  type StreamConnection,
  type StreamOptions,
} from "./socket";
import {
  resolveFetch,
  resolveWebSocket,
  type FetchLike,
  type HttpResponse,
  type SocketConstructor,
} from "./transport";

export interface TheOneClientOptions {
  baseUrl: string;
  token: string;
  fetch?: FetchLike;
  WebSocket?: SocketConstructor;
  timeoutMs?: number;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface EventStreamHandlers extends ConnectionHandlers {
  onEvent(event: ServerEvent): void;
}

export interface TerminalHandlers extends ConnectionHandlers {
  /** On (re)attach the server first replays the scrollback as one output message. */
  onOutput?(data: string): void;
  onExit?(code: number | null): void;
  onMessage?(message: TerminalServerMessage): void;
}

export interface ProcessLogHandlers extends ConnectionHandlers {
  onLine?(line: LogLine): void;
  onExit?(code: number | null): void;
  onMessage?(message: ProcessLogStreamMessage): void;
}

export interface BuildLogHandlers extends ConnectionHandlers {
  onLine?(line: LogLine): void;
  onBuild?(build: BuildJob): void;
  onExit?(code: number | null): void;
  onMessage?(message: LogStreamMessage): void;
}

export interface AgentRunHandlers extends ConnectionHandlers {
  onEvent?(event: AgentRunEvent): void;
  onRun?(run: AgentRun): void;
  onMessage?(message: AgentStreamMessage): void;
}

export interface TerminalConnection extends StreamConnection {
  /** Queued while connecting; returns false once the connection is closed. */
  send(data: string): boolean;
  resize(cols: number, rows: number): boolean;
}

export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_EVENTS_IDLE_TIMEOUT_MS = LIMITS.eventsPingIntervalMs * 2 + 10_000;

type ResponseReader<T> = (response: HttpResponse, path: string) => Promise<T>;

interface SendInit<T> {
  read: ResponseReader<T>;
  body?: unknown;
  auth?: boolean;
  options?: RequestOptions;
}

/** Returns an error when `text` is a JSON object (optionally of the given `type`) announcing another protocol version. */
export function protocolVersionMismatch(path: string, text: string, type?: string): ProtocolVersionError | null {
  const body = parseJson(text);
  if (!body.ok || typeof body.value !== "object" || body.value === null) return null;
  const record = body.value as { type?: unknown; protocolVersion?: unknown };
  if (type !== undefined && record.type !== type) return null;
  if (record.protocolVersion === undefined || record.protocolVersion === PROTOCOL_VERSION) return null;
  return new ProtocolVersionError(path, record.protocolVersion, PROTOCOL_VERSION);
}

function json<T>(schema: Schema<T>, versioned = false): ResponseReader<T> {
  return async (response, path) => {
    const text = await response.text();
    const parsed = parseJsonWith(schema, text);
    if (!parsed.ok) throw (versioned ? protocolVersionMismatch(path, text) : null) ?? new ProtocolError(path, parsed.error.message);
    return parsed.value;
  };
}

const ignoreBody: ResponseReader<void> = async (response) => {
  await response.text().catch(() => undefined);
};

const binary: ResponseReader<ArrayBuffer> = (response) => response.arrayBuffer();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function seqGate() {
  let last = -1;
  return (seq: number) => {
    if (seq <= last) return false;
    last = seq;
    return true;
  };
}

async function toApiError(response: HttpResponse): Promise<ApiError> {
  const text = await response.text().catch(() => "");
  const body = parseJson(text);
  const error = body.ok && typeof body.value === "object" && body.value !== null ? (body.value as { error?: unknown }).error : undefined;
  if (typeof error === "object" && error !== null) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof message === "string") {
      const resolved = typeof code === "string" && isErrorCode(code) ? code : errorCodeForStatus(response.status);
      return new ApiError(response.status, resolved, message);
    }
  }
  const fallback = text.trim().slice(0, 300) || response.statusText || `HTTP ${response.status}`;
  return new ApiError(response.status, errorCodeForStatus(response.status), fallback);
}

export class TheOneClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;
  private readonly webSocketImpl: SocketConstructor | undefined;

  constructor(options: TheOneClientOptions) {
    const baseUrl = normalizeBaseUrl(options.baseUrl);
    if (!baseUrl) throw new TypeError(`Invalid controller URL: ${options.baseUrl}`);
    if (!options.token) throw new TypeError("A controller token is required");
    this.baseUrl = baseUrl;
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = resolveFetch(options.fetch);
    this.webSocketImpl = options.WebSocket;
  }

  health(options?: RequestOptions): Promise<Health> {
    return this.request("GET", restPaths.health(), { read: json(HealthSchema, true), auth: false, options });
  }

  createTicket(options?: RequestOptions): Promise<Ticket> {
    return this.request("POST", restPaths.authTicket(), { read: json(TicketSchema), options });
  }

  status(options?: RequestOptions): Promise<SandboxStatus> {
    return this.request("GET", restPaths.status(), { read: json(SandboxStatusSchema), options });
  }

  context(options?: RequestOptions): Promise<AgentContext> {
    return this.request("GET", restPaths.context(), { read: json(AgentContextSchema), options });
  }

  identity(options?: RequestOptions): Promise<Identity> {
    return this.request("GET", restPaths.identity(), { read: json(IdentitySchema), options });
  }

  claudeAuth(options?: RequestOptions): Promise<ClaudeAuthStatus> {
    return this.request("GET", restPaths.claudeAuth(), { read: json(ClaudeAuthStatusSchema), options });
  }

  importClaude(body: ClaudeImport, options?: RequestOptions): Promise<ClaudeImportResult> {
    return this.request("POST", restPaths.claudeImport(), { read: json(ClaudeImportResultSchema), body, options });
  }

  ports(options?: RequestOptions): Promise<ListeningPorts> {
    return this.request("GET", restPaths.ports(), { read: json(ListeningPortsSchema), options });
  }

  usage(query?: UsageFilter, options?: RequestOptions): Promise<UsageReport> {
    return this.request("GET", restPaths.usage(query), { read: json(UsageReportSchema), options });
  }

  sessions(query?: SessionsFilter, options?: RequestOptions): Promise<ClaudeSession[]> {
    return this.request("GET", restPaths.sessions(query), { read: json(ClaudeSessionListSchema), options });
  }

  inbox(query?: InboxFilter, options?: RequestOptions): Promise<Inbox> {
    return this.request("GET", restPaths.inbox(query), { read: json(InboxSchema), options });
  }

  markInboxRead(body: MarkInboxRead, options?: RequestOptions): Promise<InboxCounts> {
    return this.request("POST", restPaths.inboxRead(), { read: json(InboxCountsSchema), body, options });
  }

  registerPushDevice(body: RegisterPushDevice, options?: RequestOptions): Promise<PushDevice> {
    return this.request("POST", restPaths.pushDevices(), { read: json(PushDeviceSchema), body, options });
  }

  unregisterPushDevice(token: string, options?: RequestOptions): Promise<PushDevice> {
    return this.request("DELETE", restPaths.pushDevice(token), { read: json(PushDeviceSchema), options });
  }

  registerLiveActivity(body: RegisterLiveActivity, options?: RequestOptions): Promise<LiveActivityToken> {
    return this.request("POST", restPaths.liveActivities(), { read: json(LiveActivityTokenSchema), body, options });
  }

  unregisterLiveActivity(token: string, options?: RequestOptions): Promise<LiveActivityToken> {
    return this.request("DELETE", restPaths.liveActivity(token), { read: json(LiveActivityTokenSchema), options });
  }

  listProjects(options?: RequestOptions): Promise<Project[]> {
    return this.request("GET", restPaths.projects(), { read: json(ProjectListSchema), options });
  }

  createProject(body: CreateProject, options?: RequestOptions): Promise<CreateProjectResponse> {
    return this.request("POST", restPaths.projects(), { read: json(CreateProjectResponseSchema), body, options });
  }

  getProject(id: string, options?: RequestOptions): Promise<Project> {
    return this.request("GET", restPaths.project(id), { read: json(ProjectSchema), options });
  }

  getProjectGit(id: string, options?: RequestOptions): Promise<GitDetails> {
    return this.request("GET", restPaths.projectGit(id), { read: json(GitDetailsSchema), options });
  }

  syncChanges(id: string, options?: RequestOptions): Promise<SyncChanges> {
    return this.request("GET", restPaths.projectSyncChanges(id), { read: json(SyncChangesSchema), options });
  }

  /** gzip tar of the current content of `paths` (each a current `added`/`modified` change). */
  syncExport(id: string, paths: string[], options?: RequestOptions): Promise<ArrayBuffer> {
    return this.request("POST", restPaths.projectSyncExport(id), { read: binary, body: { paths }, options });
  }

  syncAck(id: string, body: SyncAck, options?: RequestOptions): Promise<SyncChanges> {
    return this.request("POST", restPaths.projectSyncAck(id), { read: json(SyncChangesSchema), body, options });
  }

  syncRequests(id: string, options?: RequestOptions): Promise<SyncRequest[]> {
    return this.request("GET", restPaths.projectSyncRequests(id), { read: json(SyncRequestListSchema), options });
  }

  createSyncRequest(id: string, body: CreateSyncRequest, options?: RequestOptions): Promise<SyncRequest> {
    return this.request("POST", restPaths.projectSyncRequests(id), { read: json(SyncRequestSchema), body, options });
  }

  pendingSyncRequests(options?: RequestOptions): Promise<SyncRequest[]> {
    return this.request("GET", restPaths.syncRequests({ status: "pending" }), { read: json(SyncRequestListSchema), options });
  }

  claimSyncRequest(id: string, body: ClaimSyncRequest, options?: RequestOptions): Promise<SyncRequest> {
    return this.request("POST", restPaths.syncRequestClaim(id), { read: json(SyncRequestSchema), body, options });
  }

  completeSyncRequest(id: string, body: CompleteSyncRequest, options?: RequestOptions): Promise<SyncRequest> {
    return this.request("POST", restPaths.syncRequestComplete(id), { read: json(SyncRequestSchema), body, options });
  }

  cancelSyncRequest(id: string, options?: RequestOptions): Promise<SyncRequest> {
    return this.request("POST", restPaths.syncRequestCancel(id), { read: json(SyncRequestSchema), options });
  }

  syncHeartbeat(body: SyncHeartbeat, options?: RequestOptions): Promise<void> {
    return this.request("POST", restPaths.syncHeartbeat(), { read: ignoreBody, body, options });
  }

  listProcesses(filter?: ProjectFilter, options?: RequestOptions): Promise<ProcessInfo[]> {
    return this.request("GET", restPaths.processes(filter), { read: json(ProcessListSchema), options });
  }

  startProcess(body: StartProcess, options?: RequestOptions): Promise<ProcessInfo> {
    return this.request("POST", restPaths.processes(), { read: json(ProcessInfoSchema), body, options });
  }

  getProcess(id: string, options?: RequestOptions): Promise<ProcessInfo> {
    return this.request("GET", restPaths.process(id), { read: json(ProcessInfoSchema), options });
  }

  stopProcess(id: string, options?: RequestOptions): Promise<ProcessInfo> {
    return this.request("DELETE", restPaths.process(id), { read: json(ProcessInfoSchema), options });
  }

  processLogs(id: string, query?: LogTail, options?: RequestOptions): Promise<LogLine[]> {
    return this.request("GET", restPaths.processLogs(id, query), { read: json(LogLineListSchema), options });
  }

  listTerminals(options?: RequestOptions): Promise<TerminalInfo[]> {
    return this.request("GET", restPaths.terminals(), { read: json(TerminalListSchema), options });
  }

  createTerminal(body: CreateTerminal, options?: RequestOptions): Promise<TerminalInfo> {
    return this.request("POST", restPaths.terminals(), { read: json(TerminalInfoSchema), body, options });
  }

  closeTerminal(id: string, options?: RequestOptions): Promise<TerminalInfo> {
    return this.request("DELETE", restPaths.terminal(id), { read: json(TerminalInfoSchema), options });
  }

  listBuilds(filter?: ProjectFilter, options?: RequestOptions): Promise<BuildJob[]> {
    return this.request("GET", restPaths.builds(filter), { read: json(BuildListSchema), options });
  }

  startBuild(body: StartBuild, options?: RequestOptions): Promise<BuildJob> {
    return this.request("POST", restPaths.builds(), { read: json(BuildJobSchema), body, options });
  }

  getBuild(id: string, options?: RequestOptions): Promise<BuildJob> {
    return this.request("GET", restPaths.build(id), { read: json(BuildJobSchema), options });
  }

  cancelBuild(id: string, options?: RequestOptions): Promise<BuildJob> {
    return this.request("DELETE", restPaths.build(id), { read: json(BuildJobSchema), options });
  }

  buildLogs(id: string, query?: LogTail, options?: RequestOptions): Promise<LogLine[]> {
    return this.request("GET", restPaths.buildLogs(id, query), { read: json(LogLineListSchema), options });
  }

  listArtifacts(filter?: ProjectFilter, options?: RequestOptions): Promise<Artifact[]> {
    return this.request("GET", restPaths.artifacts(filter), { read: json(ArtifactListSchema), options });
  }

  shareArtifact(body: ShareArtifact, options?: RequestOptions): Promise<Artifact> {
    return this.request("POST", restPaths.artifacts(), { read: json(ArtifactSchema), body, options });
  }

  deleteArtifact(id: string, options?: RequestOptions): Promise<Artifact> {
    return this.request("DELETE", restPaths.artifact(id), { read: json(ArtifactSchema), options });
  }

  /** Tailnet devices that accept Taildrop files; `available: false` without the LocalAPI opt-in. */
  taildropTargets(options?: RequestOptions): Promise<TaildropTargets> {
    return this.request("GET", restPaths.taildropTargets(), { read: json(TaildropTargetsSchema), options });
  }

  sendArtifactToTaildrop(id: string, body: SendArtifact, options?: RequestOptions): Promise<Artifact> {
    return this.request("POST", restPaths.artifactTaildrop(id), { read: json(ArtifactSchema), body, options });
  }

  displayStatus(options?: RequestOptions): Promise<DisplayStatus> {
    return this.request("GET", restPaths.display(), { read: json(DisplayStatusSchema), options });
  }

  /** Chromium tabs in the sandbox, current tab first, with URLs the phone can open over Tailscale. */
  displayBrowser(options?: RequestOptions): Promise<BrowserStatus> {
    return this.request("GET", restPaths.displayBrowser(), { read: json(BrowserStatusSchema), options });
  }

  /** PNG bytes of the virtual display. */
  screenshot(options?: RequestOptions): Promise<ArrayBuffer> {
    return this.request("GET", restPaths.displayScreenshot(), { read: binary, options });
  }

  listAgentRuns(filter?: AgentRunFilter, options?: RequestOptions): Promise<AgentRun[]> {
    return this.request("GET", restPaths.agentRuns(filter), { read: json(AgentRunListSchema), options });
  }

  archiveAgentRuns(body: ArchiveAgentRuns, options?: RequestOptions): Promise<AgentRunBatchResult> {
    return this.request("POST", restPaths.agentRunsArchive(), { read: json(AgentRunBatchResultSchema), body, options });
  }

  deleteAgentRuns(body: DeleteAgentRuns, options?: RequestOptions): Promise<AgentRunBatchResult> {
    return this.request("POST", restPaths.agentRunsDelete(), { read: json(AgentRunBatchResultSchema), body, options });
  }

  startAgentRun(body: StartAgentRun, options?: RequestOptions): Promise<AgentRun> {
    return this.request("POST", restPaths.agentRuns(), { read: json(AgentRunSchema), body, options });
  }

  /** Sends the file as base64 JSON; allow a longer timeout for large files on slow links. */
  createUpload(body: CreateUpload, options?: RequestOptions): Promise<Upload> {
    return this.request("POST", restPaths.uploads(), { read: json(UploadSchema), body, options });
  }

  async uploadContentUrl(id: string, options?: RequestOptions): Promise<string> {
    const { ticket } = await this.createTicket(options);
    return this.httpUrl(restPaths.uploadContent(id, { ticket }));
  }

  transcribe(body: CreateTranscription, options?: RequestOptions): Promise<Transcription> {
    return this.request("POST", restPaths.transcriptions(), { read: json(TranscriptionSchema), body, options });
  }

  stt(options?: RequestOptions): Promise<SttStatus> {
    return this.request("GET", restPaths.stt(), { read: json(SttStatusSchema), options });
  }

  updateStt(body: UpdateStt, options?: RequestOptions): Promise<SttStatus> {
    return this.request("PUT", restPaths.stt(), { read: json(SttStatusSchema), body, options });
  }

  getAgentRun(id: string, options?: RequestOptions): Promise<AgentRunDetail> {
    return this.request("GET", restPaths.agentRun(id), { read: json(AgentRunDetailSchema), options });
  }

  cancelAgentRun(id: string, options?: RequestOptions): Promise<AgentRun> {
    return this.request("DELETE", restPaths.agentRun(id), { read: json(AgentRunSchema), options });
  }

  publishStatus(body: StatusEventInput, options?: RequestOptions): Promise<void> {
    return this.request("POST", restPaths.events(), { read: ignoreBody, body, options });
  }

  /** Headers for requests made outside this client (e.g. an <Image> source for the screenshot endpoint). */
  authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}` };
  }

  httpUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  wsUrl(path: string, ticket: string): string {
    return appendQuery(`${toWebSocketUrl(this.baseUrl)}${path}`, { [TICKET_PARAM]: ticket });
  }

  async terminalPageUrl(sessionId: string, options?: RequestOptions): Promise<string> {
    const { ticket } = await this.createTicket(options);
    return this.httpUrl(uiPaths.terminal({ ticket, session: sessionId }));
  }

  async vncPageUrl(options?: RequestOptions): Promise<string> {
    const [display, { ticket }] = await Promise.all([this.displayStatus(options), this.createTicket(options)]);
    return this.httpUrl(uiPaths.vnc({ ticket, password: display.vnc.password }));
  }

  async artifactDownloadUrl(id: string, options?: RequestOptions): Promise<string> {
    const { ticket } = await this.createTicket(options);
    return this.httpUrl(restPaths.artifactDownload(id, { ticket }));
  }

  /**
   * Server events with automatic reconnect (default on), exponential backoff and a ping watchdog.
   * A `hello` with another protocol version reports a ProtocolVersionError and closes the stream for good.
   */
  openEvents(handlers: EventStreamHandlers, options: StreamOptions = {}): StreamConnection {
    return this.openStream<ServerEvent, EventsClientMessage>({
      path: wsPaths.events(),
      schema: ServerEventSchema,
      handlers,
      options: { reconnect: true, idleTimeoutMs: DEFAULT_EVENTS_IDLE_TIMEOUT_MS, ...options },
      isHandshake: (event) => event.type === "hello",
      fatalFrame: (text) => protocolVersionMismatch(wsPaths.events(), text, "hello"),
      onMessage: (event, session) => {
        if (event.type === "ping") session.sendIfOpen({ type: "pong" });
        handlers.onEvent(event);
      },
    });
  }

  /** Reconnect is off by default because every re-attach replays the scrollback. */
  openTerminal(id: string, handlers: TerminalHandlers, options: StreamOptions = {}): TerminalConnection {
    const session = this.openStream<TerminalServerMessage, TerminalClientMessage>({
      path: wsPaths.terminalStream(id),
      schema: TerminalServerMessageSchema,
      handlers,
      options,
      isFinal: (message) => message.type === "exit",
      onMessage: (message) => {
        handlers.onMessage?.(message);
        if (message.type === "output") handlers.onOutput?.(message.data);
        else handlers.onExit?.(message.code);
      },
    });
    return {
      get state() {
        return session.state;
      },
      close: () => session.close(),
      reconnect: () => session.reconnect(),
      send: (data) => session.send({ type: "input", data }),
      resize: (cols, rows) => session.send({ type: "resize", cols, rows }),
    };
  }

  /** Replayed lines already delivered on this connection object are skipped after a reconnect (by seq). */
  openProcessLogs(id: string, handlers: ProcessLogHandlers, options: StreamOptions = {}): StreamConnection {
    const fresh = seqGate();
    return this.openStream<ProcessLogStreamMessage, never>({
      path: wsPaths.processLogStream(id),
      schema: ProcessLogStreamMessageSchema,
      handlers,
      options,
      isFinal: (message) => message.type === "exit",
      onMessage: (message) => {
        if (message.type === "log" && !fresh(message.line.seq)) return;
        handlers.onMessage?.(message);
        if (message.type === "log") handlers.onLine?.(message.line);
        else handlers.onExit?.(message.code);
      },
    });
  }

  openBuildLogs(id: string, handlers: BuildLogHandlers, options: StreamOptions = {}): StreamConnection {
    const fresh = seqGate();
    return this.openStream<LogStreamMessage, never>({
      path: wsPaths.buildLogStream(id),
      schema: LogStreamMessageSchema,
      handlers,
      options,
      isFinal: (message) => message.type === "exit" || (message.type === "build" && isFinalBuildState(message.build.state)),
      onMessage: (message) => {
        if (message.type === "log" && !fresh(message.line.seq)) return;
        handlers.onMessage?.(message);
        if (message.type === "log") handlers.onLine?.(message.line);
        else if (message.type === "build") handlers.onBuild?.(message.build);
        else handlers.onExit?.(message.code);
      },
    });
  }

  openAgentRun(id: string, handlers: AgentRunHandlers, options: StreamOptions = {}): StreamConnection {
    const fresh = seqGate();
    return this.openStream<AgentStreamMessage, never>({
      path: wsPaths.agentRunStream(id),
      schema: AgentStreamMessageSchema,
      handlers,
      options,
      isFinal: (message) => message.type === "run" && isFinalAgentRunState(message.run.state),
      onMessage: (message) => {
        if (message.type === "event" && !fresh(message.event.seq)) return;
        handlers.onMessage?.(message);
        if (message.type === "event") handlers.onEvent?.(message.event);
        else handlers.onRun?.(message.run);
      },
    });
  }

  private openStream<Incoming, Outgoing>(config: {
    path: string;
    schema: Schema<Incoming>;
    handlers: ConnectionHandlers;
    options: StreamOptions;
    onMessage: (message: Incoming, session: SocketSession<Incoming, Outgoing>) => void;
    isHandshake?: (message: Incoming) => boolean;
    isFinal?: (message: Incoming) => boolean;
    fatalFrame?: (text: string) => TheOneError | null;
  }): SocketSession<Incoming, Outgoing> {
    return new SocketSession<Incoming, Outgoing>({
      ...config,
      createTicket: () => this.createTicket(),
      buildUrl: (path, ticket) => this.wsUrl(path, ticket),
      getWebSocket: () => resolveWebSocket(this.webSocketImpl),
    }).start();
  }

  private request<T>(method: string, path: string, init: SendInit<T>): Promise<T> {
    const timeoutMs = init.options?.timeoutMs ?? this.timeoutMs;
    const external = init.options?.signal;
    if (external?.aborted) return Promise.reject(new AbortError(path));

    const controller = new AbortController();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.auth !== false) headers.Authorization = `Bearer ${this.token}`;
    if (init.body !== undefined) headers["Content-Type"] = "application/json";

    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    let settled: TheOneError | undefined;

    const work = (async () => {
      try {
        const response = await this.fetchImpl(this.httpUrl(path), {
          method,
          headers,
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          signal: controller.signal,
        });
        if (!response.ok) throw await toApiError(response);
        return await init.read(response, path);
      } catch (error) {
        if (settled) throw settled;
        if (error instanceof TheOneError) throw error;
        throw new NetworkError(`Request to ${path} failed: ${errorMessage(error)}`, { cause: error });
      }
    })();
    work.catch(() => undefined);

    // Racing guarantees the timeout/abort even if a fetch polyfill ignores AbortSignal.
    const interrupt = new Promise<never>((_, reject) => {
      const stop = (error: TheOneError) => {
        settled = error;
        controller.abort();
        reject(error);
      };
      timer = setTimeout(() => stop(new TimeoutError(path, timeoutMs)), timeoutMs);
      if (external) {
        onAbort = () => stop(new AbortError(path));
        external.addEventListener("abort", onAbort);
      }
    });

    return Promise.race([work, interrupt]).finally(() => {
      clearTimeout(timer);
      if (external && onAbort) external.removeEventListener("abort", onAbort);
    });
  }
}
