import zlib
from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from ..api.types import Project
from .icons import framework_icon
from .palette import PROJECT_TINTS


@dataclass(frozen=True)
class ProjectBadge:
    icon: str
    tint: int | None


NO_PROJECT_BADGE = ProjectBadge("project", None)


def project_tint(project_id: str) -> int:
    return zlib.crc32(project_id.encode()) % len(PROJECT_TINTS)


def project_badges(projects: Iterable[Project] | None) -> dict[str, ProjectBadge]:
    """Each project keeps its hashed tint; a clash moves to the next free one, so up to len(PROJECT_TINTS) differ."""
    badges: dict[str, ProjectBadge] = {}
    taken: set[int] = set()
    for project in sorted(projects or [], key=lambda item: item["id"]):
        tint = project_tint(project["id"])
        for step in range(len(PROJECT_TINTS)):
            candidate = (tint + step) % len(PROJECT_TINTS)
            if candidate not in taken:
                tint = candidate
                break
        taken.add(tint)
        badges[project["id"]] = ProjectBadge(framework_icon(project.get("framework")), tint)
    return badges


def project_badge(project_id: str | None, badges: Mapping[str, ProjectBadge]) -> ProjectBadge:
    if not project_id:
        return NO_PROJECT_BADGE
    return badges.get(project_id) or ProjectBadge("project", project_tint(project_id))
