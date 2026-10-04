from dataclasses import dataclass
from typing import Literal

from ..api.types import AgentRun, Project
from ..theme.tone import Tone
from ..util.format import parse_iso

RUN_TITLE_MAX_CHARS = 80
RUNS_PER_PROJECT = 5

RUN_TONES: dict[str, Tone] = {
    "running": "info",
    "succeeded": "success",
    "failed": "danger",
    "cancelled": "neutral",
}

WorkspaceState = Literal["offline", "loading", "empty", "ready"]


@dataclass(frozen=True)
class RunItem:
    id: str
    title: str
    state: str
    started_at: str | None
    tone: Tone

    @property
    def running(self) -> bool:
        return self.state == "running"


@dataclass(frozen=True)
class ProjectItem:
    id: str | None
    name: str
    branch: str | None
    running: int
    runs: tuple[RunItem, ...]
    last_activity: float | None
    confidential: bool = False

    @property
    def active(self) -> bool:
        return self.running > 0


def run_title(prompt: str | None, max_chars: int = RUN_TITLE_MAX_CHARS) -> str:
    line = next((part.strip() for part in (prompt or "").splitlines() if part.strip()), "")
    if len(line) <= max_chars:
        return line
    return line[: max_chars - 1].rstrip() + "…"


def run_activity(run: AgentRun) -> float | None:
    moments = [parse_iso(run.get("endedAt")), parse_iso(run.get("startedAt"))]
    present = [moment for moment in moments if moment is not None]
    return max(present) if present else None


def project_activity(project: Project) -> float | None:
    git = project.get("git") or {}
    commit = git.get("lastCommit") or {}
    return parse_iso(commit.get("date"))


def run_item(run: AgentRun) -> RunItem:
    state = run.get("state") or ""
    return RunItem(
        id=run["id"],
        title=run_title(run.get("prompt")),
        state=state,
        started_at=run.get("startedAt"),
        tone=RUN_TONES.get(state, "neutral"),
    )


def _latest(*moments: float | None) -> float | None:
    present = [moment for moment in moments if moment is not None]
    return max(present) if present else None


def _sorted_runs(runs: list[AgentRun]) -> list[AgentRun]:
    return sorted(runs, key=lambda run: (run.get("state") == "running", run_activity(run) or 0.0), reverse=True)


def _item(
    project_id: str | None,
    name: str,
    branch: str | None,
    runs: list[AgentRun],
    base: float | None,
    limit: int,
    confidential: bool = False,
) -> ProjectItem:
    ordered = _sorted_runs(runs)
    return ProjectItem(
        id=project_id,
        name=name,
        branch=branch,
        running=sum(1 for run in runs if run.get("state") == "running"),
        runs=tuple(run_item(run) for run in ordered[:limit]),
        last_activity=_latest(base, *(run_activity(run) for run in runs)),
        confidential=confidential,
    )


def project_items(
    projects: list[Project] | None,
    runs: list[AgentRun] | None,
    unassigned_name: str | None = None,
    limit: int = RUNS_PER_PROJECT,
) -> list[ProjectItem]:
    by_project: dict[str | None, list[AgentRun]] = {}
    for run in runs or []:
        by_project.setdefault(run.get("projectId"), []).append(run)
    known = {project["id"] for project in projects or []}
    items = [
        _item(
            project["id"],
            project.get("name") or project["id"],
            (project.get("git") or {}).get("branch"),
            by_project.get(project["id"], []),
            project_activity(project),
            limit,
            bool(project.get("confidential", False)),
        )
        for project in projects or []
    ]
    orphans = [run for key, group in by_project.items() if key is None or key not in known for run in group]
    if unassigned_name and orphans:
        items.append(_item(None, unassigned_name, None, orphans, None, limit))
    items.sort(key=lambda item: (item.id is None, -item.running, -(item.last_activity or 0.0), item.name.lower()))
    return items


def workspace_state(online: bool, projects: list[Project] | None, item_count: int) -> WorkspaceState:
    if projects is None:
        return "loading" if online else "offline"
    if item_count:
        return "ready"
    return "empty" if online else "offline"


def running_total(items: list[ProjectItem]) -> int:
    return sum(item.running for item in items)
