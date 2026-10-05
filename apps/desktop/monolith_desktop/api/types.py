import math
from typing import Any, Literal, NotRequired, TypedDict

from .errors import ProtocolError

Framework = Literal["expo", "react-native", "electron", "vite", "next", "node", "android", "python", "flutter", "unknown"]
PackageManager = Literal["bun", "pnpm", "yarn", "npm"]
BuildTarget = Literal["electron-linux", "electron-windows", "android-apk", "web", "script"]
BuildProfile = Literal["debug", "release"]
BuildState = Literal["queued", "running", "succeeded", "failed", "cancelled"]
ProcessState = Literal["starting", "running", "exited", "failed", "stopped", "orphaned"]
TerminalKind = Literal["shell", "claude"]
AgentRunState = Literal["running", "succeeded", "failed", "cancelled"]
InboxKind = Literal["needs_input", "permission", "completed", "failed", "status", "file"]
ArtifactSource = Literal["build", "agent"]
LogStream = Literal["stdout", "stderr", "system"]
ClaudeAuthMethod = Literal["oauth_token", "credentials", "api_key", "none"]
SyncChangeKind = Literal["added", "modified", "deleted"]
SyncRequestKind = Literal["pull", "revert", "get"]
SyncFileMode = Literal["100644", "100755", "120000"]
SyncRequestStatus = Literal["pending", "claimed", "applied", "failed", "cancelled"]
SyncSource = Literal["mobile", "desktop", "cli"]
RunTarget = Literal[
    "web-dev", "expo-device", "expo-web", "expo-android", "rn-android",
    "flutter-web", "flutter-linux", "flutter-android", "electron-dev", "test",
]
AppRunState = Literal["starting", "ready", "failed", "stopped", "exited"]
AppViewerKind = Literal["url", "deeplink", "display", "android", "none"]
EmulatorState = Literal["unavailable", "stopped", "starting", "running", "stopping", "failed"]

BUILD_TARGETS: tuple[str, ...] = ("electron-linux", "electron-windows", "android-apk", "web", "script")
BUILD_PROFILES: tuple[str, ...] = ("debug", "release")
FINAL_BUILD_STATES: tuple[str, ...] = ("succeeded", "failed", "cancelled")
LIVE_PROCESS_STATES: tuple[str, ...] = ("starting", "running")
LIVE_APP_RUN_STATES: tuple[str, ...] = ("starting", "ready")
ATTENTION_KINDS: tuple[str, ...] = ("needs_input", "permission")
ARTIFACT_SOURCES: tuple[str, ...] = ("build", "agent")


class Health(TypedDict):
    ok: bool
    version: str
    protocolVersion: int
    sandboxId: str


class Ticket(TypedDict):
    ticket: str
    expiresAt: str


class ToolVersion(TypedDict):
    name: str
    version: str | None


class VncStatus(TypedDict):
    available: bool
    port: int
    password: str | None


class DisplayStatus(TypedDict):
    display: str
    available: bool
    width: int | None
    height: int | None
    vnc: VncStatus
    webPath: str


class DisplayWindow(TypedDict):
    id: str
    title: str
    app: str | None
    pid: int | None
    active: bool
    minimized: bool


class DisplayWindowList(TypedDict):
    windows: list[DisplayWindow]


class CpuResources(TypedDict):
    cores: int
    load1: float
    load5: float
    load15: float


class MemoryResources(TypedDict):
    totalBytes: int
    usedBytes: int


class DiskResources(TypedDict):
    path: str
    totalBytes: int
    usedBytes: int


class Resources(TypedDict):
    cpu: CpuResources
    memory: MemoryResources
    disk: DiskResources


class Counts(TypedDict):
    projects: int
    runningProcesses: int
    activeBuilds: int
    terminals: int
    agentRuns: int


class SandboxStatus(TypedDict):
    sandboxId: str
    hostname: str
    version: str
    startedAt: str
    uptimeSec: float
    resources: Resources
    display: DisplayStatus
    tools: list[ToolVersion]
    counts: Counts


class TailscaleUser(TypedDict):
    id: str
    loginName: str
    displayName: str
    profilePicUrl: str | None


class TailnetNode(TypedDict):
    hostName: str
    dnsName: str | None
    os: str | None
    tailscaleIps: list[str]
    online: bool


class TailscaleIdentity(TypedDict):
    available: bool
    source: Literal["serve", "localapi", "none"]
    tailnet: str | None
    viewer: TailscaleUser | None
    viewerNode: TailnetNode | None
    owner: TailscaleUser | None
    node: TailnetNode | None


class Identity(TypedDict):
    sandboxId: str
    tailscale: TailscaleIdentity


class AgentContextFile(TypedDict):
    name: str
    path: str
    sizeBytes: int
    modifiedAt: str
    truncated: bool
    content: str


class AgentContext(TypedDict):
    files: list[AgentContextFile]


class LastCommit(TypedDict):
    sha: str
    subject: str
    date: str


class GitSummary(TypedDict):
    branch: str | None
    dirty: bool
    ahead: int
    behind: int
    lastCommit: LastCommit | None


class Project(TypedDict):
    id: str
    name: str
    path: str
    framework: Framework
    packageManager: PackageManager | None
    scripts: list[str]
    buildTargets: list[BuildTarget]
    git: GitSummary | None
    confidential: NotRequired[bool]
    claudeAccountId: NotRequired[str | None]


class GitFileStatus(TypedDict):
    path: str
    index: str
    worktree: str


class GitCommit(TypedDict):
    sha: str
    subject: str
    author: str
    date: str


class GitDetails(TypedDict):
    branch: str | None
    ahead: int
    behind: int
    files: list[GitFileStatus]
    log: list[GitCommit]


class SyncFileChange(TypedDict):
    path: str
    kind: SyncChangeKind
    sha256: str | None
    size: int | None
    discardable: NotRequired[bool]


class SyncHost(TypedDict):
    name: str
    lastSeenAt: str
    online: bool
    linked: bool


class SyncChanges(TypedDict):
    projectId: str
    baselineAt: str | None
    changes: list[SyncFileChange]
    totalBytes: int
    host: SyncHost | None
    lastGetAt: NotRequired[str | None]


class SyncDiscardResult(TypedDict):
    discarded: list[str]
    unavailable: list[str]
    backupPath: str | None
    changes: SyncChanges


class SyncFileStat(TypedDict):
    path: str
    kind: SyncChangeKind
    insertions: int
    deletions: int
    binary: bool
    oldMode: SyncFileMode | None
    newMode: SyncFileMode | None
    oldSize: int | None
    newSize: int | None


class SyncResult(TypedDict):
    added: int
    modified: int
    deleted: int
    conflicts: list[str]
    snapshotId: str | None
    hostPath: str | None
    files: NotRequired[list[SyncFileStat]]
    insertions: NotRequired[int]
    deletions: NotRequired[int]
    gitFiles: NotRequired[int]
    syncedAt: NotRequired[str]
    previousSyncAt: NotRequired[str | None]
    backupPath: NotRequired[str | None]


class SyncRequest(TypedDict):
    id: str
    projectId: str
    kind: SyncRequestKind
    status: SyncRequestStatus
    paths: list[str] | None
    force: bool
    source: SyncSource
    claimedBy: str | None
    result: SyncResult | None
    error: str | None
    createdAt: str
    updatedAt: str


class SyncGetChange(TypedDict):
    path: str
    kind: SyncChangeKind
    sha256: str | None
    executable: bool


class SyncGetGit(TypedDict):
    changed: list[str]
    deleted: list[str]


class SyncGetPlan(TypedDict):
    hostPath: str
    changes: list[SyncGetChange]
    git: SyncGetGit | None


class SyncGetPlanResponse(TypedDict):
    request: SyncRequest
    upload: list[str]
    gitUpload: list[str]


class CreateProjectResponse(TypedDict):
    project: Project
    processId: NotRequired[str]


class DeletedProject(TypedDict):
    id: str
    trashPath: str


class LogLine(TypedDict):
    seq: int
    ts: str
    stream: LogStream
    text: str


class RunTargetInfo(TypedDict):
    target: RunTarget
    label: str
    dir: str | None
    available: bool
    reason: str | None
    viewer: AppViewerKind
    actions: list[str]


class AppRun(TypedDict):
    id: str
    projectId: str
    target: RunTarget
    dir: str | None
    state: AppRunState
    port: int | None
    processIds: list[str]
    viewer: dict[str, Any] | None
    actions: list[str]
    error: str | None
    startedAt: str
    readyAt: str | None
    endedAt: str | None


class EmulatorInfo(TypedDict):
    state: EmulatorState
    avd: str | None
    serial: str | None
    managed: bool
    isolated: bool
    width: int | None
    height: int | None
    startedAt: str | None
    error: str | None


class SandboxAndroidStatus(TypedDict):
    linked: bool
    hostId: str | None
    emulator: EmulatorInfo | None
    adbSerial: str | None
    adbConnected: bool


class ProcessInfo(TypedDict):
    id: str
    projectId: str | None
    name: str
    command: str | list[str]
    cwd: str
    pid: int | None
    port: int | None
    display: bool
    state: ProcessState
    exitCode: int | None
    startedAt: str
    endedAt: str | None


class TerminalInfo(TypedDict):
    id: str
    kind: TerminalKind
    projectId: str | None
    title: str
    cwd: str
    pid: int | None
    cols: int
    rows: int
    state: Literal["running", "exited"]
    exitCode: int | None
    createdAt: str


class Artifact(TypedDict):
    id: str
    projectId: str
    buildId: str | None
    fileName: str
    path: str
    sizeBytes: int
    sha256: str
    platform: str
    source: ArtifactSource
    agentRunId: str | None
    note: str | None
    createdAt: str


class BuildOutput(TypedDict):
    projectId: str
    path: str
    fileName: str
    sizeBytes: int
    platform: str
    modifiedAt: str


class TaildropTarget(TypedDict):
    id: str
    hostName: str
    dnsName: str | None
    os: str | None
    online: bool


class TaildropTargets(TypedDict):
    available: bool
    targets: list[TaildropTarget]


class BuildJob(TypedDict):
    id: str
    projectId: str
    target: BuildTarget
    profile: BuildProfile
    state: BuildState
    stage: str | None
    progress: float | None
    startedAt: str | None
    endedAt: str | None
    createdAt: str
    artifacts: list[Artifact]
    error: str | None


class ListeningPort(TypedDict):
    port: int
    pid: int | None
    command: str | None
    processId: str | None
    projectId: str | None
    url: str | None
    dnsUrl: str | None


class ListeningPorts(TypedDict):
    tailscaleIp: str | None
    ports: list[ListeningPort]


class AgentUsage(TypedDict):
    inputTokens: int
    outputTokens: int
    cacheReadTokens: int
    cacheWriteTokens: int
    totalTokens: int


UploadKind = Literal["image", "pdf", "audio", "file"]


class Upload(TypedDict):
    id: str
    name: str
    mimeType: str
    kind: UploadKind
    sizeBytes: int
    path: str
    createdAt: str


class AgentRun(TypedDict):
    id: str
    projectId: str | None
    prompt: str
    attachments: NotRequired[list[Upload]]
    sessionId: str | None
    state: AgentRunState
    startedAt: str
    endedAt: str | None
    usage: AgentUsage | None
    result: str | None
    error: str | None
    archivedAt: NotRequired[str | None]
    claudeAccountId: NotRequired[str | None]


class AgentRunEvent(TypedDict):
    kind: Literal["text", "tool_use", "tool_result", "system"]
    seq: int
    ts: str
    text: NotRequired[str]
    tool: NotRequired[str | None]
    summary: NotRequired[str]
    isError: NotRequired[bool]


class AgentRunDetail(AgentRun):
    events: list[AgentRunEvent]


class InboxItem(TypedDict):
    id: str
    kind: InboxKind
    title: str
    body: str
    projectId: str | None
    sessionId: str | None
    agentRunId: str | None
    terminalId: str | None
    artifactId: NotRequired[str | None]
    createdAt: str
    updatedAt: str
    readAt: str | None


class CountResult(TypedDict):
    count: int


class InboxCounts(TypedDict):
    unreadCount: int
    attentionCount: int


class Inbox(InboxCounts):
    items: list[InboxItem]


class StatusEvent(TypedDict):
    project: str | None
    status: str
    platform: NotRequired[str]
    stage: NotRequired[str]
    message: str
    ts: str


class ClaudeAccount(TypedDict):
    email: str | None
    displayName: str | None
    organization: str | None


class ClaudeAuthSources(TypedDict):
    oauthToken: bool
    credentials: bool
    apiKey: bool


class ClaudeAuthStatus(TypedDict):
    available: bool
    method: ClaudeAuthMethod
    loggedIn: bool
    sources: ClaudeAuthSources
    oauthTokenFromEnv: bool
    account: ClaudeAccount | None
    subscriptionType: str | None
    credentialsExpiresAt: str | None
    settingsPresent: bool
    configDir: str
    importedAt: str | None


class ClaudeAccountProfile(TypedDict):
    id: str
    primary: bool
    present: bool
    loggedIn: bool
    account: ClaudeAccount | None
    subscriptionType: str | None
    credentialsExpiresAt: str | None
    settingsPresent: bool
    configDir: str


class ClaudeAccountList(TypedDict):
    defaultAccountId: str
    accounts: list[ClaudeAccountProfile]


CLAUDE_AUTH_METHODS: tuple[str, ...] = ("oauth_token", "credentials", "api_key", "none")
PRIMARY_CLAUDE_ACCOUNT_ID = "claude"


def _object(value: Any, what: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProtocolError(f"{what}: expected an object")
    return value


def _opt_str(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _token_count(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return 0
    return max(0, int(value))


def parse_agent_usage(value: Any) -> AgentUsage | None:
    if not isinstance(value, dict):
        return None
    usage: AgentUsage = {
        "inputTokens": _token_count(value.get("inputTokens")),
        "outputTokens": _token_count(value.get("outputTokens")),
        "cacheReadTokens": _token_count(value.get("cacheReadTokens")),
        "cacheWriteTokens": _token_count(value.get("cacheWriteTokens")),
        "totalTokens": _token_count(value.get("totalTokens")),
    }
    if not usage["totalTokens"]:
        usage["totalTokens"] = (
            usage["inputTokens"] + usage["outputTokens"] + usage["cacheReadTokens"] + usage["cacheWriteTokens"]
        )
    return usage


def run_total_tokens(run: Any) -> int | None:
    usage = parse_agent_usage(run.get("usage")) if isinstance(run, dict) else None
    return usage["totalTokens"] if usage else None


def parse_claude_account(value: Any) -> ClaudeAccount | None:
    if not isinstance(value, dict):
        return None
    return {
        "email": _opt_str(value.get("email")),
        "displayName": _opt_str(value.get("displayName")),
        "organization": _opt_str(value.get("organization")),
    }


def parse_claude_auth_status(value: Any) -> ClaudeAuthStatus:
    raw = _object(value, "claude auth status")
    sources = raw.get("sources") if isinstance(raw.get("sources"), dict) else {}
    method = raw.get("method")
    return {
        "available": raw.get("available") is True,
        "method": method if method in CLAUDE_AUTH_METHODS else "none",
        "loggedIn": raw.get("loggedIn") is True,
        "sources": {
            "oauthToken": sources.get("oauthToken") is True,
            "credentials": sources.get("credentials") is True,
            "apiKey": sources.get("apiKey") is True,
        },
        "oauthTokenFromEnv": raw.get("oauthTokenFromEnv") is True,
        "account": parse_claude_account(raw.get("account")),
        "subscriptionType": _opt_str(raw.get("subscriptionType")),
        "credentialsExpiresAt": _opt_str(raw.get("credentialsExpiresAt")),
        "settingsPresent": raw.get("settingsPresent") is True,
        "configDir": raw.get("configDir") if isinstance(raw.get("configDir"), str) else "",
        "importedAt": _opt_str(raw.get("importedAt")),
    }


def parse_claude_account_profile(value: Any) -> ClaudeAccountProfile | None:
    if not isinstance(value, dict) or not _opt_str(value.get("id")):
        return None
    return {
        "id": value["id"],
        "primary": value.get("primary") is True,
        "present": value.get("present") is True,
        "loggedIn": value.get("loggedIn") is True,
        "account": parse_claude_account(value.get("account")),
        "subscriptionType": _opt_str(value.get("subscriptionType")),
        "credentialsExpiresAt": _opt_str(value.get("credentialsExpiresAt")),
        "settingsPresent": value.get("settingsPresent") is True,
        "configDir": value.get("configDir") if isinstance(value.get("configDir"), str) else "",
    }


def parse_claude_account_list(value: Any) -> ClaudeAccountList:
    raw = _object(value, "claude accounts")
    accounts = raw.get("accounts") if isinstance(raw.get("accounts"), list) else []
    return {
        "defaultAccountId": _opt_str(raw.get("defaultAccountId")) or PRIMARY_CLAUDE_ACCOUNT_ID,
        "accounts": [profile for profile in map(parse_claude_account_profile, accounts) if profile is not None],
    }



SttProfile = Literal["off", "eco", "balanced", "performance"]
SttEngine = Literal["whisper.cpp", "openai-compatible"]

STT_PROFILES: tuple[str, ...] = ("off", "eco", "balanced", "performance")
STT_ENGINES: tuple[str, ...] = ("whisper.cpp", "openai-compatible")


class SttProfileInfo(TypedDict):
    id: SttProfile
    model: str | None
    threads: int
    nice: int
    available: bool


class SttStatus(TypedDict):
    profile: SttProfile
    profiles: list[SttProfileInfo]
    engine: SttEngine | None
    ready: bool
    reason: str | None
    model: str | None
    cpus: int
    busy: bool
    queued: int


def _int(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return 0
    return int(value)


def parse_stt_profile_info(value: Any) -> SttProfileInfo | None:
    if not isinstance(value, dict) or value.get("id") not in STT_PROFILES:
        return None
    return {
        "id": value["id"],
        "model": _opt_str(value.get("model")),
        "threads": max(0, _int(value.get("threads"))),
        "nice": _int(value.get("nice")),
        "available": value.get("available") is True,
    }


def parse_stt_status(value: Any) -> SttStatus:
    raw = _object(value, "stt status")
    profiles = raw.get("profiles") if isinstance(raw.get("profiles"), list) else []
    engine = raw.get("engine")
    return {
        "profile": raw["profile"] if raw.get("profile") in STT_PROFILES else "off",
        "profiles": [info for info in map(parse_stt_profile_info, profiles) if info is not None],
        "engine": engine if engine in STT_ENGINES else None,
        "ready": raw.get("ready") is True,
        "reason": _opt_str(raw.get("reason")),
        "model": _opt_str(raw.get("model")),
        "cpus": max(0, _int(raw.get("cpus"))),
        "busy": raw.get("busy") is True,
        "queued": max(0, _int(raw.get("queued"))),
    }

UsageReport = dict[str, Any]
ClaudeSession = dict[str, Any]
ServerEvent = dict[str, Any]

SERVER_EVENT_TYPES: tuple[str, ...] = (
    "hello",
    "ping",
    "status",
    "process.updated",
    "terminal.updated",
    "build.updated",
    "artifact.created",
    "artifact.deleted",
    "agent.updated",
    "agent.deleted",
    "inbox.updated",
    "project.updated",
    "project.deleted",
)
