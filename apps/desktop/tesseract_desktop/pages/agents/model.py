import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from ...api.types import ATTENTION_KINDS, AgentRun, InboxCounts, InboxItem, Project, run_total_tokens
from ...theme.project_tints import NO_PROJECT_BADGE, ProjectBadge, project_badge, project_badges, project_tint
from ...theme.tone import Tone
from ...util.format import elapsed_seconds, format_duration, format_relative_time, format_tokens, join_meta, pluralize
from ...util.markdown import plain_text
from .labels import MANAGE, NO_PROJECT, NO_PROJECT_OPTION, STATES, UNTITLED

FINAL_STATES = ("succeeded", "failed", "cancelled")
TITLE_LIMIT = 80
STATE_TONES: Mapping[str, Tone] = {"running": "info", "succeeded": "success", "failed": "danger", "cancelled": "neutral"}
STATE_ICONS: Mapping[str, str] = {"succeeded": "status-done-all", "failed": "failed", "cancelled": "status-canceled"}
NO_PROJECT_KEY = ""
TERMINAL_SOURCES = ("terminal", "cli")
ARCHIVED_FILTER = "archived"
DESTRUCTIVE_ACTIONS = ("delete", "delete_all", "empty_archive")
LEADING_NOISE = re.compile(r"^(?:#+\s*|[-*>]\s+|\d+[.)]\s+)")


def is_final(run: AgentRun | None) -> bool:
    return bool(run) and run["state"] in FINAL_STATES


def run_title(prompt: str | None, limit: int = TITLE_LIMIT) -> str:
    for line in (prompt or "").splitlines():
        cleaned = " ".join(plain_text(LEADING_NOISE.sub("", line.strip())).split())
        if cleaned:
            return cleaned if len(cleaned) <= limit else cleaned[: limit - 1].rstrip() + "…"
    return UNTITLED


def state_label(state: str) -> str:
    return STATES.get(state, state.title())


def state_tone(state: str) -> Tone:
    return STATE_TONES.get(state, "neutral")


def project_names(projects: Iterable[Project] | None) -> dict[str, str]:
    return {project["id"]: project["name"] for project in projects or []}


def project_name(project_id: str | None, names: Mapping[str, str]) -> str:
    if not project_id:
        return NO_PROJECT
    return names.get(project_id, project_id)


def project_options(projects: Iterable[Project] | None) -> list[tuple[str, str]]:
    options = [(NO_PROJECT_KEY, NO_PROJECT_OPTION)]
    options.extend((p["id"], p["name"]) for p in sorted(projects or [], key=lambda p: p["name"].lower()))
    return options


def attention_items(items: Iterable[InboxItem] | None) -> list[InboxItem]:
    return [item for item in items or [] if item["kind"] in ATTENTION_KINDS and not item.get("readAt")]


def is_file_item(item: InboxItem) -> bool:
    return item["kind"] == "file" and bool(item.get("artifactId"))


def notice_items(items: Iterable[InboxItem] | None) -> list[InboxItem]:
    return [
        item for item in items or []
        if (item["kind"] in ATTENTION_KINDS or is_file_item(item)) and not item.get("readAt")
    ]


def notice_style(item: InboxItem) -> tuple[str, Tone]:
    return ("files", "info") if is_file_item(item) else ("warning", "warning")


def attention_for_run(run: AgentRun, items: Iterable[InboxItem]) -> list[InboxItem]:
    session = run.get("sessionId")
    return [
        item for item in items
        if item.get("agentRunId") == run["id"] or (session and item.get("sessionId") == session and not item.get("agentRunId"))
    ]


def matches_query(run: AgentRun, query: str, names: Mapping[str, str]) -> bool:
    needle = query.strip().lower()
    if not needle:
        return True
    haystack = (
        run.get("prompt") or "",
        project_name(run.get("projectId"), names),
        run.get("result") or "",
        run.get("error") or "",
        run["id"],
        run.get("sessionId") or "",
    )
    return any(needle in value.lower() for value in haystack)


def filter_runs(
    runs: Iterable[AgentRun] | None,
    filter_id: str,
    query: str = "",
    names: Mapping[str, str] | None = None,
    attention: Iterable[InboxItem] = (),
) -> list[AgentRun]:
    names = names or {}
    attention = list(attention)
    result = []
    for run in runs or []:
        if filter_id == "running" and run["state"] != "running":
            continue
        if filter_id == "attention" and not attention_for_run(run, attention):
            continue
        if matches_query(run, query, names):
            result.append(run)
    return result


@dataclass(frozen=True)
class RunGroup:
    key: str
    title: str
    runs: tuple[AgentRun, ...]


def sort_recent(runs: Iterable[AgentRun]) -> list[AgentRun]:
    return sorted(runs, key=lambda r: r.get("startedAt") or "", reverse=True)


def group_runs(runs: Iterable[AgentRun], names: Mapping[str, str]) -> list[RunGroup]:
    buckets: dict[str, list[AgentRun]] = {}
    for run in sort_recent(runs):
        buckets.setdefault(run.get("projectId") or NO_PROJECT_KEY, []).append(run)
    return [
        RunGroup(key, project_name(key or None, names), tuple(items))
        for key, items in buckets.items()
    ]


def is_follow_up(run: AgentRun, runs: Iterable[AgentRun]) -> bool:
    return previous_run(run, runs) is not None


def previous_run(run: AgentRun, runs: Iterable[AgentRun]) -> AgentRun | None:
    session = run.get("sessionId")
    if not session:
        return None
    earlier = [
        other for other in runs
        if other["id"] != run["id"] and other.get("sessionId") == session and (other.get("startedAt") or "") < (run.get("startedAt") or "")
    ]
    return max(earlier, key=lambda other: other.get("startedAt") or "", default=None)


def run_duration(run: AgentRun, now: float | None = None) -> str | None:
    seconds = elapsed_seconds(run.get("startedAt"), run.get("endedAt"), now)
    return format_duration(seconds) if seconds is not None else None


def row_meta(run: AgentRun, names: Mapping[str, str], follow_up_label: str | None = None) -> str:
    return join_meta(project_name(run.get("projectId"), names), format_tokens(run_total_tokens(run)), follow_up_label)


def header_meta(run: AgentRun, names: Mapping[str, str], now: float | None = None) -> str:
    return join_meta(
        project_name(run.get("projectId"), names),
        format_relative_time(run.get("startedAt"), now),
        run_duration(run, now),
        format_tokens(run_total_tokens(run)),
        run.get("claudeAccountId"),
    )


def short_id(value: str | None, length: int = 8) -> str:
    return (value or "")[:length]


def terminal_sessions(sessions: Iterable[Mapping] | None) -> list[Mapping]:
    return [
        session for session in sessions or []
        if session.get("source") in TERMINAL_SOURCES and session.get("terminalId") and session.get("active")
    ]


def terminal_for_run(run: AgentRun | None, sessions: Iterable[Mapping] | None) -> str | None:
    if not run or not run.get("sessionId"):
        return None
    for session in sessions or []:
        if session.get("sessionId") == run["sessionId"] and session.get("terminalId"):
            return session["terminalId"]
    return None


def follow_up_state(run: AgentRun | None) -> str:
    if run is None or run["state"] == "running":
        return "running"
    if not run.get("sessionId"):
        return "no_session"
    return "ready"


def badge_count(runs: Iterable[AgentRun] | None, inbox: InboxCounts | None) -> int | None:
    running = sum(1 for run in runs or [] if run["state"] == "running")
    total = running + int((inbox or {}).get("attentionCount", 0) or 0)
    return total or None


def upsert_run(runs: list[AgentRun] | None, run: AgentRun) -> list[AgentRun]:
    current = list(runs or [])
    for index, existing in enumerate(current):
        if existing["id"] == run["id"]:
            current[index] = {**existing, **run}
            return current
    return [run, *current]


def strip_events(run: Mapping) -> AgentRun:
    return {key: value for key, value in run.items() if key != "events"}  # type: ignore[return-value]


def is_archived(run: Mapping | None) -> bool:
    return bool(run and run.get("archivedAt"))


def can_manage(run: Mapping | None) -> bool:
    return bool(run) and run.get("state") != "running"


def finished_ids(runs: Iterable[AgentRun] | None) -> list[str]:
    return [run["id"] for run in runs or [] if can_manage(run)]


def row_actions(state: str, archived_view: bool) -> tuple[str, ...]:
    if state == "running":
        return ()
    return ("unarchive" if archived_view else "archive", "delete")


def bulk_actions(runs: Iterable[AgentRun] | None, archived_runs: Iterable[AgentRun] | None, archived_view: bool) -> tuple[str, ...]:
    if archived_view:
        return ("empty_archive",) if finished_ids(archived_runs) else ()
    return ("archive_all", "delete_all") if finished_ids(runs) else ()


def action_sections(actions: Iterable[str]) -> list[list[str]]:
    actions = list(actions)
    return [
        [action for action in actions if action not in DESTRUCTIVE_ACTIONS],
        [action for action in actions if action in DESTRUCTIVE_ACTIONS],
    ]


def count_label(count: int) -> str:
    return pluralize(count, MANAGE["noun"])
