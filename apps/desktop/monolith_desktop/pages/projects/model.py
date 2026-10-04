import re
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any, TypeVar
from pathlib import Path
from urllib.parse import urlsplit

from ...api.errors import ApiError, ControllerError
from ...api.types import (
    FINAL_BUILD_STATES,
    LIVE_PROCESS_STATES,
    AgentRun,
    Artifact,
    BuildJob,
    ClaudeAccountList,
    GitFileStatus,
    GitSummary,
    ListeningPort,
    ProcessInfo,
    Project,
    SyncChanges,
    SyncDiscardResult,
    SyncFileChange,
    SyncRequest,
    run_total_tokens,
)
from ...syncback.errors import SyncBackError
from ...syncback.manifest import resolve_inside
from ...syncback.pull import is_conflict as file_conflicts
from ...syncback.state import Link, Snapshot, SyncState
from ...syncback.summary import plural
from ...theme.tone import Tone
from ...util.format import (
    elapsed_seconds,
    format_duration,
    format_relative_time,
    format_tokens,
    join_meta,
    parse_iso,
    short_sha,
)
from .labels import (
    ACTIVITY,
    BUILD_PROFILES,
    BUILD_STATES,
    BUILD_TARGETS,
    BUILDS,
    CLAUDE_ACCOUNT,
    CONFIDENTIAL,
    CREATE,
    DEFAULT_PACKAGE_MANAGER,
    FRAMEWORKS,
    GIT,
    LOGS,
    PROCESS_STATES,
    PROCESSES,
    PROJECTS_ROOT,
    RUN_STATES,
    SYNC,
    SYNC_BLOCKED,
    SYNC_CODES,
    SYNC_STATES,
    VALIDATION,
)

T = TypeVar("T")

PROJECT_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
PROJECT_ID_MAX_LENGTH = 64
GIT_URL_PATTERN = re.compile(r"^(?:https?://|ssh://|git://|file://|[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:)\S+$")
GIT_REF_PATTERN = re.compile(r"^(?![-/.])(?!.*\.\.)[A-Za-z0-9._/-]{1,255}$")
MAX_NAME_LENGTH = 128
MAX_GIT_URL_LENGTH = 2048
MAX_COMMAND_LENGTH = 16_384
MIN_PORT, MAX_PORT = 1, 65535
SHELL_SAFE_WORD = re.compile(r"^[\w.:@/+=-]+$")
GUI_FRAMEWORKS = frozenset({"electron"})
DEFAULT_CLAUDE_ACCOUNT = ""

PROCESS_TONES: dict[str, Tone] = {
    "starting": "info", "running": "success", "exited": "neutral",
    "failed": "danger", "stopped": "neutral", "orphaned": "warning",
}
BUILD_TONES: dict[str, Tone] = {
    "queued": "neutral", "running": "info", "succeeded": "success", "failed": "danger", "cancelled": "warning",
}
RUN_TONES: dict[str, Tone] = {"running": "info", "succeeded": "success", "failed": "danger", "cancelled": "warning"}
GIT_CHANGE_NAMES = {
    "M": "Modified", "A": "Added", "D": "Deleted", "R": "Renamed", "C": "Copied",
    "U": "Conflict", "?": "Untracked", "!": "Ignored", "T": "Type changed",
}


def project_id_from_name(name: str) -> str | None:
    slug = re.sub(r"[^a-z0-9._-]+", "-", name.strip().lower())
    slug = re.sub(r"-{2,}", "-", slug)
    slug = re.sub(r"^[._-]+", "", slug)[:PROJECT_ID_MAX_LENGTH]
    slug = re.sub(r"[._-]+$", "", slug)
    return slug if PROJECT_ID_PATTERN.match(slug) else None


@dataclass(frozen=True)
class ProjectDraft:
    name: str = ""
    git_url: str = ""
    branch: str = ""
    confidential: bool = False


@dataclass(frozen=True)
class DraftResult:
    errors: dict[str, str] = field(default_factory=dict)
    project_id: str | None = None
    name: str = ""
    git_url: str | None = None
    branch: str | None = None
    confidential: bool = False

    @property
    def ok(self) -> bool:
        return not self.errors and self.project_id is not None


def _name_error(name: str, project_id: str | None, existing_ids: Iterable[str]) -> str | None:
    if not name:
        return VALIDATION["name_required"]
    if len(name) > MAX_NAME_LENGTH:
        return VALIDATION["name_too_long"].format(max=MAX_NAME_LENGTH)
    if not project_id:
        return VALIDATION["name_invalid"]
    if project_id in set(existing_ids):
        return VALIDATION["name_exists"].format(root=PROJECTS_ROOT, id=project_id)
    return None


def _git_url_error(git_url: str) -> str | None:
    if git_url and (len(git_url) > MAX_GIT_URL_LENGTH or not GIT_URL_PATTERN.match(git_url)):
        return VALIDATION["git_url"]
    return None


def _branch_error(branch: str, git_url: str) -> str | None:
    if not branch:
        return None
    if not git_url:
        return VALIDATION["branch_needs_url"]
    return None if GIT_REF_PATTERN.match(branch) else VALIDATION["branch_invalid"]


def validate_project_draft(draft: ProjectDraft, existing_ids: Iterable[str] = ()) -> DraftResult:
    name, git_url, branch = draft.name.strip(), draft.git_url.strip(), draft.branch.strip()
    project_id = project_id_from_name(name)
    candidates = {
        "name": _name_error(name, project_id, existing_ids),
        "git_url": _git_url_error(git_url),
        "branch": _branch_error(branch, git_url),
    }
    errors = {key: message for key, message in candidates.items() if message}
    return DraftResult(errors, project_id, name, git_url or None, (branch or None) if git_url else None, draft.confidential)


def is_confidential(project: Project) -> bool:
    return bool(project.get("confidential", False))


def confidential_badge(project: Project) -> tuple[str, Tone] | None:
    return (CONFIDENTIAL["badge"], "warning") if is_confidential(project) else None


def project_claude_account(project: Project) -> str | None:
    return project.get("claudeAccountId") or None


def effective_claude_account(project: Project, accounts: ClaudeAccountList | None) -> str | None:
    return project_claude_account(project) or (accounts["defaultAccountId"] if accounts else None)


def claude_account_options(project: Project, accounts: ClaudeAccountList) -> list[tuple[str, str]]:
    options = [(DEFAULT_CLAUDE_ACCOUNT, CLAUDE_ACCOUNT["default"].format(id=accounts["defaultAccountId"]))]
    for profile in accounts["accounts"]:
        email = (profile["account"] or {}).get("email")
        options.append((profile["id"], join_meta(profile["id"], email)))
    pinned = project_claude_account(project)
    if pinned and all(option_id != pinned for option_id, _ in options):
        options.append((pinned, pinned))
    return options


def claude_account_label(project: Project, accounts: ClaudeAccountList | None) -> str | None:
    account = effective_claude_account(project, accounts)
    return CLAUDE_ACCOUNT["badge"].format(id=account) if account else None


def location_hint(name: str) -> str:
    project_id = project_id_from_name(name)
    if project_id:
        return CREATE["location"].format(root=PROJECTS_ROOT, id=project_id)
    return CREATE["location_empty"].format(root=PROJECTS_ROOT)


def create_label(git_url: str) -> str:
    return CREATE["clone"] if git_url.strip() else CREATE["create"]


def is_conflict(error: BaseException) -> bool:
    return isinstance(error, ApiError) and (error.status == 409 or error.code == "conflict")


@dataclass(frozen=True)
class CloneOutcome:
    label: str
    tone: Tone
    message: str
    done: bool
    ok: bool


def clone_outcome(exit_code: int | None, finished: bool) -> CloneOutcome:
    if not finished:
        return CloneOutcome(CREATE["cloning"], "info", "", False, False)
    if exit_code == 0:
        return CloneOutcome(CREATE["cloned"], "success", CREATE["clone_done"], True, True)
    reason = CREATE["clone_failed_signal"] if exit_code is None else CREATE["clone_failed_code"].format(code=exit_code)
    return CloneOutcome(CREATE["failed"], "danger", f"{reason} {CREATE['clone_failed_hint']}", True, False)


@dataclass(frozen=True)
class ProcessDraft:
    command: str = ""
    name: str = ""
    port: str = ""
    display: bool = False


@dataclass(frozen=True)
class ProcessDraftResult:
    errors: dict[str, str]
    body: dict[str, Any]

    @property
    def ok(self) -> bool:
        return not self.errors


def parse_port(value: str) -> int | None:
    text = value.strip()
    if not text.isdigit():
        return None
    port = int(text)
    return port if MIN_PORT <= port <= MAX_PORT else None


def validate_process_draft(draft: ProcessDraft, project_id: str) -> ProcessDraftResult:
    command, name, port_text = draft.command.strip(), draft.name.strip(), draft.port.strip()
    errors: dict[str, str] = {}
    if not command:
        errors["command"] = VALIDATION["command_required"]
    elif len(command) > MAX_COMMAND_LENGTH:
        errors["command"] = VALIDATION["command_too_long"].format(max=MAX_COMMAND_LENGTH)
    if len(name) > MAX_NAME_LENGTH:
        errors["name"] = VALIDATION["name_too_long"].format(max=MAX_NAME_LENGTH)
    port = parse_port(port_text) if port_text else None
    if port_text and port is None:
        errors["port"] = VALIDATION["port_invalid"]
    body: dict[str, Any] = {"projectId": project_id, "command": command}
    if name:
        body["name"] = name
    if port is not None:
        body["port"] = port
    if draft.display:
        body["display"] = True
    return ProcessDraftResult(errors, body)


def shell_word(value: str) -> str:
    if SHELL_SAFE_WORD.match(value):
        return value
    escaped = value.replace("'", "'\\''")
    return f"'{escaped}'"


def script_command(package_manager: str | None, script: str) -> str:
    return f"{package_manager or DEFAULT_PACKAGE_MANAGER} run {shell_word(script)}"


def command_label(command: str | Sequence[str]) -> str:
    return command if isinstance(command, str) else " ".join(command)


def prefers_display(framework: str) -> bool:
    return framework in GUI_FRAMEWORKS


def framework_label(framework: str | None) -> str:
    return FRAMEWORKS.get(framework or "unknown", FRAMEWORKS["unknown"])


def target_label(target: str) -> str:
    return BUILD_TARGETS.get(target, (target, ""))[0]


def target_platform(target: str) -> str:
    return BUILD_TARGETS.get(target, ("", ""))[1]


def profile_label(profile: str) -> str:
    return BUILD_PROFILES.get(profile, profile)


def is_live_process(process: ProcessInfo) -> bool:
    return process.get("state") in LIVE_PROCESS_STATES


def is_final_build(build: BuildJob) -> bool:
    return build.get("state") in FINAL_BUILD_STATES


def process_state(process: ProcessInfo) -> tuple[str, Tone]:
    state = process.get("state", "exited")
    if state == "exited" and process.get("exitCode") not in (0, None):
        return PROCESS_STATES["failed"], "danger"
    return PROCESS_STATES.get(state, state), PROCESS_TONES.get(state, "neutral")


def build_state(build: BuildJob) -> tuple[str, Tone]:
    state = build.get("state", "queued")
    return BUILD_STATES.get(state, state), BUILD_TONES.get(state, "neutral")


def run_state(run: AgentRun) -> tuple[str, Tone]:
    state = run.get("state", "running")
    return RUN_STATES.get(state, state), RUN_TONES.get(state, "neutral")


def sync_label(ahead: int, behind: int) -> str | None:
    parts = []
    if ahead:
        parts.append(GIT["ahead"].format(count=ahead))
    if behind:
        parts.append(GIT["behind"].format(count=behind))
    return " ".join(parts) or None


def dirty_badge(git: GitSummary | None, changes: int | None = None) -> tuple[str, Tone] | None:
    if not git:
        return None
    if not git.get("dirty"):
        return GIT["clean"], "success"
    return (GIT["changes"].format(count=changes) if changes else GIT["dirty"]), "warning"


def git_file_code(file: GitFileStatus) -> str:
    return f"{file.get('index', '')}{file.get('worktree', '')}".strip() or "?"


def git_file_tone(file: GitFileStatus) -> Tone:
    code = git_file_code(file)
    if "?" in code:
        return "info"
    if "U" in code or "D" in code:
        return "danger"
    if "A" in code:
        return "success"
    return "warning"


def git_file_kind(file: GitFileStatus) -> str:
    code = git_file_code(file)
    if "U" in code:
        return GIT_CHANGE_NAMES["U"]
    for letter in code.replace(" ", ""):
        if letter in GIT_CHANGE_NAMES:
            return GIT_CHANGE_NAMES[letter]
    return code


def commit_meta(commit: dict[str, Any], now: float | None = None) -> str:
    return join_meta(short_sha(commit.get("sha", "")), commit.get("author"), format_relative_time(commit.get("date"), now))


def newest_first(items: Iterable[T], key: Callable[[T], str | None], limit: int | None = None) -> list[T]:
    ordered = sorted(items, key=lambda item: parse_iso(key(item)) or 0.0, reverse=True)
    return ordered[:limit] if limit else ordered


def for_project(items: Iterable[T] | None, project_id: str) -> list[T]:
    return [item for item in items or [] if item.get("projectId") == project_id]


def project_processes(processes: Iterable[ProcessInfo] | None, project_id: str) -> list[ProcessInfo]:
    mine = newest_first(for_project(processes, project_id), lambda p: p.get("startedAt"))
    return sorted(mine, key=lambda p: not is_live_process(p))


def project_builds(builds: Iterable[BuildJob] | None, project_id: str) -> list[BuildJob]:
    return newest_first(for_project(builds, project_id), lambda b: b.get("createdAt"))


def project_artifacts(artifacts: Iterable[Artifact] | None, project_id: str) -> list[Artifact]:
    return newest_first(for_project(artifacts, project_id), lambda a: a.get("createdAt"))


def project_runs(runs: Iterable[AgentRun] | None, project_id: str) -> list[AgentRun]:
    return newest_first(for_project(runs, project_id), lambda r: r.get("startedAt"))


def project_ports(ports: Iterable[ListeningPort] | None, project_id: str) -> list[ListeningPort]:
    return sorted(for_project(ports, project_id), key=lambda p: p.get("port", 0))


def host_of(base_url: str | None) -> str | None:
    if not base_url:
        return None
    try:
        return urlsplit(base_url).hostname
    except ValueError:
        return None


def site_url(port: ListeningPort, fallback_host: str | None = None) -> str | None:
    url = port.get("url") or port.get("dnsUrl")
    if url:
        return url
    if fallback_host:
        host = f"[{fallback_host}]" if ":" in fallback_host else fallback_host
        return f"http://{host}:{port['port']}"
    return None


@dataclass(frozen=True)
class Activity:
    kind: str
    label: str
    tone: Tone
    running: int = 0


def project_activity(
    project_id: str,
    processes: Iterable[ProcessInfo] | None,
    builds: Iterable[BuildJob] | None,
    runs: Iterable[AgentRun] | None,
) -> Activity:
    running = sum(1 for p in for_project(processes, project_id) if is_live_process(p))
    if any(r.get("state") == "running" for r in for_project(runs, project_id)):
        return Activity("agent", ACTIVITY["agent"], "info", running)
    if any(not is_final_build(b) for b in for_project(builds, project_id)):
        return Activity("building", ACTIVITY["building"], "info", running)
    if running:
        return Activity("running", ACTIVITY["running"].format(count=running), "success", running)
    return Activity("idle", ACTIVITY["idle"], "neutral", 0)


def _latest(values: Iterable[str | None]) -> float:
    return max((parse_iso(value) or 0.0 for value in values), default=0.0)


def activity_timestamp(
    project: Project,
    processes: Iterable[ProcessInfo] | None,
    builds: Iterable[BuildJob] | None,
    runs: Iterable[AgentRun] | None,
) -> float:
    project_id = project["id"]
    git = project.get("git") or {}
    commit = git.get("lastCommit") or {}
    stamps: list[str | None] = [commit.get("date")]
    for process in for_project(processes, project_id):
        stamps += [process.get("startedAt"), process.get("endedAt")]
    for build in for_project(builds, project_id):
        stamps += [build.get("createdAt"), build.get("endedAt")]
    for run in for_project(runs, project_id):
        stamps += [run.get("startedAt"), run.get("endedAt")]
    return _latest(stamps)


def sort_projects(
    projects: Iterable[Project],
    processes: Iterable[ProcessInfo] | None = None,
    builds: Iterable[BuildJob] | None = None,
    runs: Iterable[AgentRun] | None = None,
) -> list[Project]:
    processes, builds, runs = list(processes or []), list(builds or []), list(runs or [])

    def key(project: Project) -> tuple[bool, float, str]:
        busy = project_activity(project["id"], processes, builds, runs).kind != "idle"
        return (not busy, -activity_timestamp(project, processes, builds, runs), project.get("name", "").lower())

    return sorted(projects, key=key)


def matches(project: Project, query: str) -> bool:
    tokens = query.lower().split()
    if not tokens:
        return True
    git = project.get("git") or {}
    haystack = " ".join(filter(None, [
        project.get("name"), project["id"], framework_label(project.get("framework")),
        git.get("branch"), project.get("packageManager"), *project.get("buildTargets", []),
        CONFIDENTIAL["badge"] if is_confidential(project) else None,
    ])).lower()
    return all(token in haystack for token in tokens)


def filter_projects(projects: Iterable[Project], query: str) -> list[Project]:
    return [project for project in projects if matches(project, query)]


@dataclass(frozen=True)
class ProjectCardModel:
    id: str
    title: str
    subtitle: str
    activity: Activity
    branch: str | None
    sync: str | None
    dirty: tuple[str, Tone] | None
    commit: str | None
    commit_when: str | None
    tags: tuple[str, ...]
    confidential: tuple[str, Tone] | None = None


def project_subtitle(project: Project) -> str:
    return join_meta(framework_label(project.get("framework")), project.get("packageManager"), project["id"])


def card_model(
    project: Project,
    processes: Iterable[ProcessInfo] | None = None,
    builds: Iterable[BuildJob] | None = None,
    runs: Iterable[AgentRun] | None = None,
    now: float | None = None,
) -> ProjectCardModel:
    git = project.get("git")
    commit = (git or {}).get("lastCommit")
    return ProjectCardModel(
        project["id"],
        project.get("name") or project["id"],
        project_subtitle(project),
        project_activity(project["id"], processes, builds, runs),
        ((git.get("branch") or GIT["detached"]) if git else GIT["none"]),
        sync_label(git.get("ahead", 0), git.get("behind", 0)) if git else None,
        dirty_badge(git),
        (commit.get("subject") or None) if commit else (GIT["no_commits"] if git else None),
        format_relative_time(commit.get("date"), now) if commit else None,
        tuple(target_label(target) for target in project.get("buildTargets", [])),
        confidential_badge(project),
    )


def detail_subtitle(project: Project) -> str:
    return join_meta(framework_label(project.get("framework")), project.get("path"))


def process_meta(process: ProcessInfo, now: float | None = None) -> str:
    started = format_relative_time(process.get("startedAt"), now)
    extras = []
    if process.get("port"):
        extras.append(PROCESSES["port"].format(port=process["port"]))
    if process.get("display"):
        extras.append(PROCESSES["display"])
    if is_live_process(process):
        if process.get("pid"):
            extras.append(PROCESSES["pid"].format(pid=process["pid"]))
        return join_meta(PROCESSES["meta_running"].format(when=started), *extras)
    seconds = elapsed_seconds(process.get("startedAt"), process.get("endedAt"), now)
    ended = format_relative_time(process.get("endedAt"), now) or started
    if process.get("exitCode") is not None:
        extras.append(PROCESSES["exit"].format(code=process["exitCode"]))
    duration = format_duration(seconds) if seconds is not None else ""
    return join_meta(PROCESSES["meta_ended"].format(duration=duration, when=ended), *extras)


def build_progress(build: BuildJob) -> float | None:
    if is_final_build(build):
        return None
    progress = build.get("progress")
    return float(progress) if isinstance(progress, int | float) else None


def build_meta(build: BuildJob, now: float | None = None) -> str:
    when = format_relative_time(build.get("startedAt") or build.get("createdAt"), now)
    parts = [BUILDS["meta"].format(profile=profile_label(build.get("profile", "debug")), when=when)]
    if build.get("stage") and not is_final_build(build):
        parts.append(BUILDS["stage"].format(stage=build["stage"]))
    if is_final_build(build):
        seconds = elapsed_seconds(build.get("startedAt"), build.get("endedAt"), now)
        if seconds is not None and build.get("startedAt"):
            parts.append(format_duration(seconds))
    if build.get("artifacts"):
        parts.append(BUILDS["artifacts"].format(count=len(build["artifacts"])))
    return join_meta(*parts)


def run_title(run: AgentRun) -> str:
    return " ".join((run.get("prompt") or "").split()) or run["id"]


def run_meta(run: AgentRun, now: float | None = None) -> str:
    return join_meta(format_relative_time(run.get("startedAt"), now), format_tokens(run_total_tokens(run)), run.get("error"))


def running_count(processes: Iterable[ProcessInfo] | None) -> int:
    return sum(1 for process in processes or [] if is_live_process(process))


def active_build_count(builds: Iterable[BuildJob] | None) -> int:
    return sum(1 for build in builds or [] if not is_final_build(build))


def log_status(state: str, exit_code: int | None = None, ended: bool = False) -> tuple[str, Tone]:
    if ended:
        if exit_code is None:
            return LOGS["killed"], "neutral"
        return LOGS["exit"].format(code=exit_code), "success" if exit_code == 0 else "danger"
    if state == "open":
        return LOGS["live"], "success"
    if state == "connecting":
        return LOGS["connecting"], "warning"
    return LOGS["ended"], "neutral"



def sync_change_code(kind: str) -> tuple[str, Tone]:
    return SYNC_CODES.get(kind, ("?", "neutral"))  # type: ignore[return-value]


def sync_request_state(status: str) -> tuple[str, Tone]:
    return SYNC_STATES.get(status, (status, "neutral"))  # type: ignore[return-value]


def listed_paths(paths: Sequence[str], limit: int = 12) -> str:
    lines = list(paths[:limit])
    if len(paths) > limit:
        lines.append(SYNC["more"].format(count=len(paths) - limit))
    return "\n".join(lines)


@dataclass(frozen=True)
class SyncView:
    link: Link | None = None
    changes: SyncChanges | None = None
    requests: tuple[SyncRequest, ...] = ()
    snapshots: tuple[Snapshot, ...] = ()
    conflicts: frozenset[str] = frozenset()
    error: BaseException | None = field(default=None, compare=False)

    @property
    def files(self) -> list[SyncFileChange]:
        return list((self.changes or {}).get("changes") or [])

    @property
    def revertible(self) -> Snapshot | None:
        return next((s for s in self.snapshots if not s.reverted), None)

    @property
    def in_flight(self) -> bool:
        return any(r.get("status") in ("pending", "claimed") for r in self.requests)

    @property
    def pushed(self) -> bool:
        return self.changes is not None and self.changes.get("baselineAt") is not None

    @property
    def discardable(self) -> list[SyncFileChange]:
        return [change for change in self.files if change.get("discardable")]

    @property
    def get_conflicts(self) -> list[str]:
        """Sandbox edits the newest get stopped on, so the next one should be forced."""
        last = next((r for r in self.requests if r.get("kind") == "get"), None)
        if last is None or last.get("status") != "failed":
            return []
        return list((last.get("result") or {}).get("conflicts") or [])


SYNC_ACTIONS = ("pull", "get", "revert", "discard")


def _first_reason(*checks: tuple[bool, str]) -> str | None:
    return next((SYNC_BLOCKED[reason] for blocked, reason in checks if blocked), None)


def sync_blockers(view: SyncView, busy: bool = False) -> dict[str, str | None]:
    """Why each sync action can't run right now (`None`: it can)."""
    linked = view.link is not None
    loaded = (view.changes is None, "unavailable" if view.error is not None else "loading")
    pushed = (not view.pushed, "never_pushed")
    active = (busy or view.in_flight, "active")
    return {
        "pull": _first_reason((not linked, "not_linked"), loaded, pushed, active, (not view.files, "nothing_to_sync")),
        "get": _first_reason((not linked, "not_linked"), loaded, pushed, active),
        "revert": _first_reason((not linked, "not_linked"), active, (view.revertible is None, "no_snapshot")),
        "discard": _first_reason(
            loaded, pushed, active, (not view.files, "nothing_to_discard"), (not view.discardable, "not_discardable")
        ),
    }


def discard_summary(result: SyncDiscardResult) -> tuple[str, Tone]:
    discarded, unavailable = result.get("discarded") or [], result.get("unavailable") or []
    lines = [SYNC["discarded"].format(count=plural(len(discarded), "file")) if discarded else SYNC["discarded_none"]]
    if unavailable:
        lines.append(SYNC["discard_unavailable"].format(count=plural(len(unavailable), "file"), files=", ".join(unavailable)))
    if result.get("backupPath"):
        lines.append(SYNC["discard_backup"].format(path=result["backupPath"]))
    return "\n".join(lines), "warning" if unavailable or not discarded else "success"


def load_sync_view(client: Any, state: SyncState, project_id: str) -> SyncView:
    link = state.link(project_id)
    snapshots = tuple(state.snapshots(project_id))
    try:
        changes = client.sync_changes(project_id)
        requests = tuple(client.list_sync_requests(project_id))
    except ControllerError as error:
        return SyncView(link, snapshots=snapshots, error=error)
    if link is None:
        return SyncView(None, changes, requests, snapshots)
    conflicts = set()
    root = Path(link.host_path)
    for change in changes.get("changes") or []:
        try:
            if file_conflicts(resolve_inside(root, change["path"]), link.manifest.get(change["path"]), change.get("sha256")):
                conflicts.add(change["path"])
        except SyncBackError:
            conflicts.add(change["path"])
    return SyncView(link, changes, requests, snapshots, frozenset(conflicts))
