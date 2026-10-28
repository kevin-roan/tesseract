import {
  AndroidDeviceSchema,
  AndroidLinkInfoSchema,
  AndroidStreamSettingsSchema,
  AppRunListSchema,
  AppRunSchema,
  RuntimeEntrySchema,
  RuntimeListSchema,
  type RuntimeEntry,
  type RuntimeKind,
  type RuntimeList,
  EmulatorInfoSchema,
  HostAndroidStatusSchema,
  HostWorkspaceAccessSchema,
  RunTargetListSchema,
  SandboxAndroidStatusSchema,
  type AndroidDevice,
  type AndroidLinkInfo,
  type AndroidStreamSettings,
  type AppRun,
  type AppRunAction,
  type AppRunFilter,
  type EmulatorInfo,
  type HostAndroidStatus,
  type HostWorkspaceAccess,
  type LinkSandbox,
  type UpdateAndroidStream,
  type RunTargetInfo,
  type SandboxAndroidStatus,
  type StartAppRun,
  type StartEmulator,
  type StopSignal,
  type BootSimulator,
  HostIosStatusSchema,
  IosInstallRequestSchema,
  IosLinkInfoSchema,
  SandboxIosStatusSchema,
  IosLinkRequestSchema,
  SimDeviceSchema,
  IosStreamSettingsSchema,
  type IosStreamSettings,
  type UpdateIosStream,
  type HostIosStatus,
  type IosInstallRequest,
  type IosLinkInfo,
  type SandboxIosStatus,
  type IosLinkRequest,
  type SimDevice,
  AgentContextSchema,
  AgentRunBatchResultSchema,
  AgentRunDetailSchema,
  AgentRunListSchema,
  AgentRunSchema,
  AgentStreamMessageSchema,
  appendQuery,
  ArtifactListSchema,
  ProjectDirectorySchema,
  ProjectFileSchema,
  ProjectStorageSchema,
  BuildOutputListSchema,
  ArtifactSchema,
  BrowserStatusSchema,
  DisplayWindowListSchema,
  BuildJobSchema,
  BuildListSchema,
  ClaudeAccountListSchema,
  ClaudeCommandListSchema,
  ClaudeAuthStatusSchema,
  ClaudeImportResultSchema,
  ClaudeSessionListSchema,
  CreateProjectResponseSchema,
  DeployListSchema,
  DeploySchema,
  DeployTargetsSchema,
  IssueCommentSchema,
  IssueDetailSchema,
  IssueListSchema,
  IssueSchema,
  DisplayStatusSchema,
  errorCodeForStatus,
  GitDetailsSchema,
  ProjectGitResultSchema,
  HealthSchema,
  HostHealthSchema,
  HostLockStatusSchema,
  HostSessionSchema,
  IdentitySchema,
  InboxCountsSchema,
  SyncChangesSchema,
  SyncDiscardResultSchema,
  DeletedProjectSchema,
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
  type ClearProjectStorage,
  type ProjectDirectory,
  type ProjectFile,
  type ProjectStorage,
  type SendProjectFile,
  type BuildOutput,
  type SendArtifact,
  type ShareArtifact,
  type TaildropTargets,
  type ClaudeSession,
  type BrowserStatus,
  type CloseDisplayWindow,
  type DisplayWindowList,
  type BuildJob,
  type CreateProject,
  type CreateProjectResponse,
  type CreateTerminal,
  type ClaimDeploy,
  type CompleteDeploy,
  type CreateDeploy,
  type Deploy,
  type DeployFilter,
  type DeployProgress,
  type DeployTargets,
  type PutDeployTargets,
  type CreateIssue,
  type CreateIssueComment,
  type DispatchIssue,
  type Issue,
  type IssueComment,
  type IssueDetail,
  type IssueFilter,
  type UpdateIssue,
  type DisplayStatus,
  type EventsClientMessage,
  type GitDetails,
  type ProjectGitResult,
  type RunProjectGit,
  type Health,
  type HostHealth,
  type HostLockStatus,
  type HostSession,
  type ClaudeAccountList,
  type ClaudeCommand,
  type ClaudeAuthStatus,
  type SetDefaultClaudeAccount,
  type SetProjectClaudeAccount,
  type RenameProject,
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
  type SyncDiscard,
  type SyncDiscardResult,
  type DeletedProject,
  type ForceParam,
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
} from "@tesseract/protocol";
import { AbortError, ApiError, NetworkError, ProtocolError, ProtocolVersionError, TesseractError, TimeoutError } from "./errors";
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

export interface TesseractClientOptions {
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

/**
 * Options of the host stop routes: a string `signal` is the stop signal (`?signal=SIGKILL` force-kills), an
 * `AbortSignal` (or `abort`) cancels the request as in `RequestOptions`.
 */
export interface StopRequestOptions {
  signal?: StopSignal | AbortSignal;
  abort?: AbortSignal;
  timeoutMs?: number;
}

function splitStopOptions(options?: StopRequestOptions): { query: string; request: RequestOptions } {
  const signal = typeof options?.signal === "string" ? options.signal : undefined;
  const abort = options?.abort ?? (typeof options?.signal === "object" ? options.signal : undefined);
  return { query: signal ? `?signal=${signal}` : "", request: { signal: abort, timeoutMs: options?.timeoutMs } };
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
export const PROJECT_GIT_TIMEOUT_MS = 310_000;
export const DEPLOY_CREATE_TIMEOUT_MS = 10 * 60_000;
export const DEPLOY_BUNDLE_TIMEOUT_MS = 30 * 60_000;
export const DEPLOY_SHA256_HEADER = "x-tesseract-sha256";

/** A deploy archive (`application/gzip`) and the sha256 the controller announced for it. */
export type DeployBundle = { sha256: string | null; data: ArrayBuffer };
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

const deployBundle: ResponseReader<DeployBundle> = async (response) => ({
  sha256: response.headers.get(DEPLOY_SHA256_HEADER),
  data: await response.arrayBuffer(),
});

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

export class TesseractClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  private readonly token: string;
  private readonly fetchImpl: FetchLike;
  private readonly webSocketImpl: SocketConstructor | undefined;

  constructor(protected readonly options: TesseractClientOptions) {
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

  claudeAccounts(options?: RequestOptions): Promise<ClaudeAccountList> {
    return this.request("GET", restPaths.claudeAccounts(), { read: json(ClaudeAccountListSchema), options });
  }

  claudeCommands(query?: ProjectFilter, options?: RequestOptions): Promise<ClaudeCommand[]> {
    return this.request("GET", restPaths.claudeCommands(query), { read: json(ClaudeCommandListSchema), options });
  }

  setDefaultClaudeAccount(body: SetDefaultClaudeAccount, options?: RequestOptions): Promise<ClaudeAccountList> {
    return this.request("PUT", restPaths.claudeDefaultAccount(), { read: json(ClaudeAccountListSchema), body, options });
  }

  setProjectClaudeAccount(id: string, body: SetProjectClaudeAccount, options?: RequestOptions): Promise<Project> {
    return this.request("PUT", restPaths.projectClaudeAccount(id), { read: json(ProjectSchema), body, options });
  }

  renameProject(id: string, body: RenameProject, options?: RequestOptions): Promise<Project> {
    return this.request("PUT", restPaths.projectName(id), { read: json(ProjectSchema), body, options });
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

  /** Moves the project out of the sandbox; without `force`, 409 when it has changes not synced back to the host. */
  deleteProject(id: string, query?: ForceParam, options?: RequestOptions): Promise<DeletedProject> {
    return this.request("DELETE", restPaths.project(id, query), { read: json(DeletedProjectSchema), options });
  }

  getProjectGit(id: string, options?: RequestOptions): Promise<GitDetails> {
    return this.request("GET", restPaths.projectGit(id), { read: json(GitDetailsSchema), options });
  }

  /** 409 with git's output when the command fails (e.g. a pull that is not a fast-forward). */
  runProjectGit(id: string, body: RunProjectGit, options?: RequestOptions): Promise<ProjectGitResult> {
    return this.request("POST", restPaths.projectGit(id), { read: json(ProjectGitResultSchema), body, options: { timeoutMs: PROJECT_GIT_TIMEOUT_MS, ...options } });
  }

  /** One directory of the project; `path` is relative to the project root ("" for the root). */
  listProjectFiles(id: string, path = "", options?: RequestOptions): Promise<ProjectDirectory> {
    return this.request("GET", restPaths.projectFiles(id, path ? { path } : undefined), { read: json(ProjectDirectorySchema), options });
  }

  sendProjectFileToTaildrop(id: string, body: SendProjectFile, options?: RequestOptions): Promise<ProjectFile> {
    return this.request("POST", restPaths.projectFileTaildrop(id), { read: json(ProjectFileSchema), body, options });
  }

  /** Disk usage of the project folder, split into source and regenerable categories (cached for a short while). */
  projectStorage(id: string, options?: RequestOptions): Promise<ProjectStorage> {
    return this.request("GET", restPaths.projectStorage(id), { read: json(ProjectStorageSchema), options });
  }

  /** Deletes regenerable folders (all categories when `categories` is omitted); 409 while anything runs in the project. */
  clearProjectStorage(id: string, body: ClearProjectStorage = {}, options?: RequestOptions): Promise<ProjectStorage> {
    return this.request("POST", restPaths.projectStorageClear(id), { read: json(ProjectStorageSchema), body, options });
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

  syncDiscard(id: string, body: SyncDiscard = {}, options?: RequestOptions): Promise<SyncDiscardResult> {
    return this.request("POST", restPaths.projectSyncDiscard(id), { read: json(SyncDiscardResultSchema), body, options });
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

  listDeploys(filter?: DeployFilter, options?: RequestOptions): Promise<Deploy[]> {
    return this.request("GET", restPaths.deploys(filter), { read: json(DeployListSchema), options });
  }

  /** The controller archives `body.path` before answering, so this waits up to `DEPLOY_CREATE_TIMEOUT_MS`. */
  createDeploy(body: CreateDeploy, options?: RequestOptions): Promise<Deploy> {
    return this.request("POST", restPaths.deploys(), { read: json(DeploySchema), body, options: { timeoutMs: DEPLOY_CREATE_TIMEOUT_MS, ...options } });
  }

  getDeploy(id: string, options?: RequestOptions): Promise<Deploy> {
    return this.request("GET", restPaths.deploy(id), { read: json(DeploySchema), options });
  }

  deployTargets(options?: RequestOptions): Promise<DeployTargets> {
    return this.request("GET", restPaths.deployTargets(), { read: json(DeployTargetsSchema), options });
  }

  putDeployTargets(body: PutDeployTargets, options?: RequestOptions): Promise<DeployTargets> {
    return this.request("PUT", restPaths.deployTargets(), { read: json(DeployTargetsSchema), body, options });
  }

  claimDeploy(id: string, body: ClaimDeploy, options?: RequestOptions): Promise<Deploy> {
    return this.request("POST", restPaths.deployClaim(id), { read: json(DeploySchema), body, options });
  }

  /** Only while the deploy is claimed, awaiting approval or deploying; compare `sha256` with `Deploy.sha256`. */
  deployBundle(id: string, options?: RequestOptions): Promise<DeployBundle> {
    return this.request("GET", restPaths.deployBundle(id), { read: deployBundle, options: { timeoutMs: DEPLOY_BUNDLE_TIMEOUT_MS, ...options } });
  }

  deployProgress(id: string, body: DeployProgress, options?: RequestOptions): Promise<Deploy> {
    return this.request("POST", restPaths.deployProgress(id), { read: json(DeploySchema), body, options });
  }

  completeDeploy(id: string, body: CompleteDeploy, options?: RequestOptions): Promise<Deploy> {
    return this.request("POST", restPaths.deployComplete(id), { read: json(DeploySchema), body, options });
  }

  cancelDeploy(id: string, options?: RequestOptions): Promise<Deploy> {
    return this.request("POST", restPaths.deployCancel(id), { read: json(DeploySchema), options });
  }

  listIssues(filter?: IssueFilter, options?: RequestOptions): Promise<Issue[]> {
    return this.request("GET", restPaths.issues(filter), { read: json(IssueListSchema), options });
  }

  createIssue(projectId: string, body: CreateIssue, options?: RequestOptions): Promise<Issue> {
    return this.request("POST", restPaths.projectIssues(projectId), { read: json(IssueSchema), body, options });
  }

  getIssue(id: string, options?: RequestOptions): Promise<IssueDetail> {
    return this.request("GET", restPaths.issue(id), { read: json(IssueDetailSchema), options });
  }

  updateIssue(id: string, body: UpdateIssue, options?: RequestOptions): Promise<Issue> {
    return this.request("PATCH", restPaths.issue(id), { read: json(IssueSchema), body, options });
  }

  deleteIssue(id: string, options?: RequestOptions): Promise<Issue> {
    return this.request("DELETE", restPaths.issue(id), { read: json(IssueSchema), options });
  }

  commentOnIssue(id: string, body: CreateIssueComment, options?: RequestOptions): Promise<IssueComment> {
    return this.request("POST", restPaths.issueComments(id), { read: json(IssueCommentSchema), body, options });
  }

  /** Starts Claude on the issue (assigning it to `claude`); 409 while a run for it is still running. */
  dispatchIssue(id: string, body: DispatchIssue = {}, options?: RequestOptions): Promise<Issue> {
    return this.request("POST", restPaths.issueDispatch(id), { read: json(IssueSchema), body, options });
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

  /** `signal: "SIGKILL"` kills the process group at once instead of SIGTERM plus grace period. */
  stopProcess(id: string, options?: StopRequestOptions): Promise<ProcessInfo> {
    const { query, request } = splitStopOptions(options);
    return this.request("DELETE", `${restPaths.process(id)}${query}`, { read: json(ProcessInfoSchema), options: request });
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

  listBuildOutputs(filter?: ProjectFilter, options?: RequestOptions): Promise<BuildOutput[]> {
    return this.request("GET", restPaths.buildOutputs(filter), { read: json(BuildOutputListSchema), options });
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

  /** Application windows on the virtual display, for switching and closing them from the phone. */
  displayWindows(options?: RequestOptions): Promise<DisplayWindowList> {
    return this.request("GET", restPaths.displayWindows(), { read: json(DisplayWindowListSchema), options });
  }

  /** Raises and focuses a window, restoring it when minimized. */
  activateDisplayWindow(id: string, options?: RequestOptions): Promise<void> {
    return this.request("POST", restPaths.displayWindowActivate(id), { read: ignoreBody, options });
  }

  /** Asks the window to close; `force` kills its client instead (for hung apps). */
  closeDisplayWindow(id: string, body: CloseDisplayWindow = {}, options?: RequestOptions): Promise<void> {
    return this.request("POST", restPaths.displayWindowClose(id), { read: ignoreBody, body, options });
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

  listRunTargets(projectId: string, options?: RequestOptions): Promise<RunTargetInfo[]> {
    return this.request("GET", restPaths.projectRunTargets(projectId), { read: json(RunTargetListSchema), options });
  }

  listAppRuns(filter?: AppRunFilter, options?: RequestOptions): Promise<AppRun[]> {
    return this.request("GET", restPaths.appRuns(filter), { read: json(AppRunListSchema), options });
  }

  /** 400 target not offered, 503 target unavailable (message = reason), 409 port taken or the target already runs. */
  startAppRun(projectId: string, body: StartAppRun, options?: RequestOptions): Promise<AppRun> {
    return this.request("POST", restPaths.projectAppRuns(projectId), { read: json(AppRunSchema), body, options });
  }

  getAppRun(id: string, options?: RequestOptions): Promise<AppRun> {
    return this.request("GET", restPaths.appRun(id), { read: json(AppRunSchema), options });
  }

  /** `signal: "SIGKILL"` kills the run's process groups at once. */
  stopAppRun(id: string, options?: StopRequestOptions): Promise<AppRun> {
    const { query, request } = splitStopOptions(options);
    return this.request("DELETE", `${restPaths.appRun(id)}${query}`, { read: json(AppRunSchema), options: request });
  }

  /** Everything stoppable in the sandbox: processes, app runs, agent runs, terminals, Chromium, the VNC display. */
  runtime(options?: RequestOptions): Promise<RuntimeList> {
    return this.request("GET", restPaths.runtime(), { read: json(RuntimeListSchema), options });
  }

  /** `SIGTERM` (default) stops gracefully, `SIGKILL` kills at once; 404 when the entry is gone. */
  stopRuntime(kind: RuntimeKind, id: string, options?: StopRequestOptions): Promise<RuntimeEntry> {
    const { query, request } = splitStopOptions(options);
    return this.request("DELETE", `${restPaths.runtimeEntry(kind, id)}${query}`, { read: json(RuntimeEntrySchema), options: request });
  }

  /** 409 when the run is not ready or does not support the action, 502 when the action failed. */
  appRunAction(id: string, action: AppRunAction, options?: RequestOptions): Promise<AppRun> {
    return this.request("POST", restPaths.appRunActions(id), { read: json(AppRunSchema), body: { action }, options });
  }

  /** The sandbox side of the Android link (controller `GET /v1/android`). */
  getAndroidStatus(options?: RequestOptions): Promise<SandboxAndroidStatus> {
    return this.request("GET", restPaths.android(), { read: json(SandboxAndroidStatusSchema), options });
  }

  /** Host daemon (session client): the host workspace controller (URL + token) and its linked repositories; 404 before it was set up. */
  hostWorkspace(options?: RequestOptions): Promise<HostWorkspaceAccess> {
    return this.request("GET", restPaths.hostWorkspace(), { read: json(HostWorkspaceAccessSchema), options });
  }

  /** Host daemon (session client): emulator, AVDs and the sandbox link. */
  hostAndroidStatus(options?: RequestOptions): Promise<HostAndroidStatus> {
    return this.request("GET", restPaths.android(), { read: json(HostAndroidStatusSchema), options });
  }

  startEmulator(body: StartEmulator, options?: RequestOptions): Promise<EmulatorInfo> {
    return this.request("POST", restPaths.androidEmulator(), { read: json(EmulatorInfoSchema), body, options });
  }

  /** `{ signal: "SIGKILL" }` kills the emulator at once; the default `SIGTERM` stops it gracefully. */
  stopEmulator(options?: StopRequestOptions): Promise<EmulatorInfo> {
    const { query, request } = splitStopOptions(options);
    return this.request("DELETE", `${restPaths.androidEmulator()}${query}`, { read: json(EmulatorInfoSchema), options: request });
  }

  linkSandbox(body: LinkSandbox, options?: RequestOptions): Promise<AndroidLinkInfo> {
    return this.request("POST", restPaths.androidLink(), { read: json(AndroidLinkInfoSchema), body, options });
  }

  androidDevices(options?: RequestOptions): Promise<AndroidDevice[]> {
    return this.request("GET", restPaths.androidDevices(), { read: json(AndroidDeviceSchema.array()), options });
  }

  androidStreamSettings(options?: RequestOptions): Promise<AndroidStreamSettings> {
    return this.request("GET", restPaths.androidStream(), { read: json(AndroidStreamSettingsSchema), options });
  }

  updateAndroidStream(body: UpdateAndroidStream, options?: RequestOptions): Promise<AndroidStreamSettings> {
    return this.request("PUT", restPaths.androidStream(), { read: json(AndroidStreamSettingsSchema), body, options });
  }

  unlinkSandbox(options?: RequestOptions): Promise<AndroidLinkInfo> {
    return this.request("DELETE", restPaths.androidLink(), { read: json(AndroidLinkInfoSchema), options });
  }

  /** The sandbox side of the iOS link (controller `GET /v1/ios`). */
  getIosStatus(options?: RequestOptions): Promise<SandboxIosStatus> {
    return this.request("GET", restPaths.ios(), { read: json(SandboxIosStatusSchema), options });
  }

  /**
   * Controller: installs a simulator build artifact (`.tar.gz`/`.tgz`/`.zip` with an `.app`) on the linked host's booted
   * Simulator. `202` with the `running` request; it ends in `SandboxIosStatus.requests` (the host may ask the user first).
   * 503 when no iOS link is connected.
   */
  installOnSimulator(artifactId: string, options?: RequestOptions): Promise<IosLinkRequest> {
    return this.request("POST", restPaths.iosInstalls(), { read: json(IosLinkRequestSchema), body: { artifactId }, options });
  }

  /** Host daemon (session client): Simulator devices, the sandbox link, tunnels and installs. */
  hostIosStatus(options?: RequestOptions): Promise<HostIosStatus> {
    return this.request("GET", restPaths.ios(), { read: json(HostIosStatusSchema), options });
  }

  /** `202` with `booting`; 404 unknown device, 409 when another device is booted or this one is not shut down, 503 not available. */
  bootSimulator(body: BootSimulator, options?: RequestOptions): Promise<SimDevice> {
    return this.request("POST", restPaths.iosSimulator(), { read: json(SimDeviceSchema), body, options });
  }

  /** Shuts the booted device down; `{ signal: "SIGKILL" }` kills its processes first. 409 when none is booted. */
  shutdownSimulator(options?: StopRequestOptions): Promise<SimDevice> {
    const { query, request } = splitStopOptions(options);
    return this.request("DELETE", `${restPaths.iosSimulator()}${query}`, { read: json(SimDeviceSchema), options: request });
  }

  linkIosSandbox(body: LinkSandbox, options?: RequestOptions): Promise<IosLinkInfo> {
    return this.request("POST", restPaths.iosLink(), { read: json(IosLinkInfoSchema), body, options });
  }

  unlinkIosSandbox(options?: RequestOptions): Promise<IosLinkInfo> {
    return this.request("DELETE", restPaths.iosLink(), { read: json(IosLinkInfoSchema), options });
  }

  iosInstalls(options?: RequestOptions): Promise<IosInstallRequest[]> {
    return this.request("GET", restPaths.iosInstalls(), { read: json(IosInstallRequestSchema.array()), options });
  }

  /** Approves (and remembers the bundle hash) or rejects a pending install; 409 when it is no longer pending. */
  decideIosInstall(id: string, approve: boolean, options?: RequestOptions): Promise<IosInstallRequest> {
    return this.request("POST", restPaths.iosInstall(id), { read: json(IosInstallRequestSchema), body: { approve }, options });
  }

  /** Host daemon iOS screen stream settings; changing them restarts the running screen sessions. */
  iosStreamSettings(options?: RequestOptions): Promise<IosStreamSettings> {
    return this.request("GET", restPaths.iosStream(), { read: json(IosStreamSettingsSchema), options });
  }

  updateIosStream(body: UpdateIosStream, options?: RequestOptions): Promise<IosStreamSettings> {
    return this.request("PUT", restPaths.iosStream(), { read: json(IosStreamSettingsSchema), body, options });
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

  /** Host daemon `/ui/android` with a fresh ticket (session client); `serial` picks another adb device than the default. */
  async androidScreenPageUrl(maxSize?: number, serial?: string, options?: RequestOptions): Promise<string> {
    const { ticket } = await this.createTicket(options);
    return this.httpUrl(uiPaths.android({ ticket, maxSize, serial }));
  }

  /** Host daemon `/ui/ios` with a fresh ticket (session client); `udid` picks another booted device than the default. */
  async iosScreenPageUrl(maxSize?: number, udid?: string, options?: RequestOptions): Promise<string> {
    const { ticket } = await this.createTicket(options);
    return this.httpUrl(uiPaths.ios({ ticket, maxSize, udid }));
  }

  /** `WS /v1/ios/screen` with a fresh ticket, for viewers other than the page (same messages as the Android screen). */
  async iosScreenSocketUrl(maxSize?: number, udid?: string, options?: RequestOptions): Promise<string> {
    const { ticket } = await this.createTicket(options);
    return this.wsUrl(wsPaths.iosScreen({ maxSize, udid }), ticket);
  }

  async artifactDownloadUrl(id: string, options?: RequestOptions): Promise<string> {
    const { ticket } = await this.createTicket(options);
    return this.httpUrl(restPaths.artifactDownload(id, { ticket }));
  }

  async projectFileDownloadUrl(projectId: string, path: string, options?: RequestOptions): Promise<string> {
    const { ticket } = await this.createTicket(options);
    return this.httpUrl(restPaths.projectFileDownload(projectId, { path, ticket }));
  }

  async buildOutputDownloadUrl(output: Pick<BuildOutput, "projectId" | "path">, options?: RequestOptions): Promise<string> {
    const { ticket } = await this.createTicket(options);
    return this.httpUrl(restPaths.buildOutputDownload(output.projectId, { path: output.path, ticket }));
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
    fatalFrame?: (text: string) => TesseractError | null;
  }): SocketSession<Incoming, Outgoing> {
    return new SocketSession<Incoming, Outgoing>({
      ...config,
      createTicket: () => this.createTicket(),
      buildUrl: (path, ticket) => this.wsUrl(path, ticket),
      getWebSocket: () => resolveWebSocket(this.webSocketImpl),
    }).start();
  }

  protected request<T>(method: string, path: string, init: SendInit<T>): Promise<T> {
    const timeoutMs = init.options?.timeoutMs ?? this.timeoutMs;
    const external = init.options?.signal;
    if (external?.aborted) return Promise.reject(new AbortError(path));

    const controller = new AbortController();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.auth !== false) headers.Authorization = `Bearer ${this.token}`;
    if (init.body !== undefined) headers["Content-Type"] = "application/json";

    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    let settled: TesseractError | undefined;

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
        if (error instanceof TesseractError) throw error;
        throw new NetworkError(`Request to ${path} failed: ${errorMessage(error)}`, { cause: error });
      }
    })();
    work.catch(() => undefined);

    // Racing guarantees the timeout/abort even if a fetch polyfill ignores AbortSignal.
    const interrupt = new Promise<never>((_, reject) => {
      const stop = (error: TesseractError) => {
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

/**
 * Client of the host shell daemon (`tesseract-controller host serve`). `token` is the host token from
 * `tesseract-controller host pair`; it only reads the lock state and trades the PIN for a session.
 * Terminals, tickets and the `/ui/terminal` page go through `sessionClient(session)`.
 */
export class HostShellClient extends TesseractClient {
  hostHealth(options?: RequestOptions): Promise<HostHealth> {
    return this.request("GET", restPaths.health(), { read: json(HostHealthSchema, true), auth: false, options });
  }

  lockStatus(options?: RequestOptions): Promise<HostLockStatus> {
    return this.request("GET", restPaths.hostLock(), { read: json(HostLockStatusSchema), options });
  }

  /** 403 for a wrong PIN or while locked out (see `lockStatus`), 503 when no PIN is set on the host. */
  unlock(pin: string, options?: RequestOptions): Promise<HostSession> {
    return this.request("POST", restPaths.hostUnlock(), { read: json(HostSessionSchema), body: { pin }, options });
  }

  lock(session: string, options?: RequestOptions): Promise<void> {
    return this.request("POST", restPaths.hostLock(), { read: ignoreBody, body: { session }, options });
  }

  sessionClient(session: string): TesseractClient {
    return new TesseractClient({ ...this.options, token: session });
  }
}
