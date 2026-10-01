import re
from collections.abc import Iterable, Mapping

from ...api.errors import ApiError
from ...api.types import ARTIFACT_SOURCES, Artifact, Project, TaildropTarget, TaildropTargets
from ...theme.tone import Tone
from ...util.format import format_bytes, format_relative_time, join_meta, parse_iso, pluralize, short_sha
from .labels import ARTIFACTS, FILES, SOURCES

ALL = ""
UNSAFE_FILE_CHARS = re.compile(r"[\x00-\x1f]+")
PATH_SEPARATORS = re.compile(r"[\\/]")
SOURCE_TONES: Mapping[str, Tone] = {"build": "neutral", "agent": "info"}


def safe_file_name(name: str, fallback: str = "artifact") -> str:
    cleaned = UNSAFE_FILE_CHARS.sub("_", PATH_SEPARATORS.split(name)[-1]).strip().lstrip(".")
    return cleaned or fallback


def source_of(artifact: Artifact) -> str:
    source = artifact.get("source")
    return source if source in ARTIFACT_SOURCES else "build"


def source_badge(artifact: Artifact) -> tuple[str, Tone]:
    source = source_of(artifact)
    return SOURCES[source], SOURCE_TONES[source]


def artifact_meta(artifact: Artifact, now: float | None = None, project: str | None = None) -> str:
    return join_meta(
        project,
        format_bytes(artifact.get("sizeBytes")),
        artifact.get("platform") or "—",
        format_relative_time(artifact.get("createdAt"), now),
    )


def artifact_detail(artifact: Artifact) -> str:
    note = (artifact.get("note") or "").strip()
    return note or ARTIFACTS["sha"].format(sha=short_sha(artifact.get("sha256") or ""))


def newest_artifacts(artifacts: Iterable[Artifact] | None) -> list[Artifact]:
    return sorted(artifacts or [], key=lambda a: parse_iso(a.get("createdAt")) or 0.0, reverse=True)


def filter_artifacts(artifacts: Iterable[Artifact] | None, project_id: str = ALL, source: str = ALL) -> list[Artifact]:
    return [
        artifact
        for artifact in newest_artifacts(artifacts)
        if (not project_id or artifact.get("projectId") == project_id) and (not source or source_of(artifact) == source)
    ]


def upsert_artifact(artifacts: Iterable[Artifact] | None, artifact: Artifact) -> list[Artifact]:
    rest = [a for a in artifacts or [] if a["id"] != artifact["id"]]
    return newest_artifacts([artifact, *rest])


def remove_artifact(artifacts: Iterable[Artifact] | None, artifact_id: str) -> list[Artifact]:
    return [a for a in artifacts or [] if a["id"] != artifact_id]


def find_artifact(artifacts: Iterable[Artifact] | None, artifact_id: str) -> Artifact | None:
    return next((a for a in artifacts or [] if a["id"] == artifact_id), None)


def project_names(projects: Iterable[Project] | None) -> dict[str, str]:
    return {project["id"]: project.get("name") or project["id"] for project in projects or []}


def project_options(artifacts: Iterable[Artifact] | None, names: Mapping[str, str]) -> list[tuple[str, str]]:
    ids = {a["projectId"] for a in artifacts or [] if a.get("projectId")} | set(names)
    ordered = sorted(ids, key=lambda pid: names.get(pid, pid).lower())
    return [(ALL, FILES["all_projects"]), *((pid, names.get(pid, pid)) for pid in ordered)]


def source_options() -> list[tuple[str, str]]:
    return [(ALL, FILES["all_sources"]), *((source, SOURCES[source]) for source in ARTIFACT_SOURCES)]


def files_subtitle(artifacts: Iterable[Artifact]) -> str:
    items = list(artifacts)
    projects = {a.get("projectId") for a in items}
    return FILES["subtitle"].format(count=pluralize(len(items), "file"), projects=pluralize(len(projects), "project"))


def online_targets(taildrop: TaildropTargets | None) -> list[TaildropTarget]:
    if not taildrop or not taildrop.get("available"):
        return []
    return sorted(
        (target for target in taildrop.get("targets") or [] if target.get("online")),
        key=lambda target: target.get("hostName", "").lower(),
    )


def target_label(target: TaildropTarget) -> str:
    return join_meta(target.get("hostName") or target["id"], target.get("os"))


def taildrop_available(taildrop: TaildropTargets | None) -> bool:
    return bool(taildrop and taildrop.get("available"))


def is_missing(error: BaseException) -> bool:
    return isinstance(error, ApiError) and error.status == 404
