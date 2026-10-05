import re
from collections.abc import Iterable, Mapping
from typing import Any, TypeVar

from ...api.errors import ApiError
from ...api.types import ARTIFACT_SOURCES, Artifact, BuildOutput, Project, TaildropTarget, TaildropTargets
from ...theme.tone import Tone
from ...util.format import format_bytes, format_relative_time, join_meta, parse_iso, pluralize, short_sha
from .labels import ARTIFACTS, FILES, OUTPUTS, SOURCES, VIEWS

T = TypeVar("T", bound=Mapping[str, Any])

ALL = ""
UNSAFE_FILE_CHARS = re.compile(r"[\x00-\x1f]+")
PATH_SEPARATORS = re.compile(r"[\\/]")
SOURCE_TONES: Mapping[str, Tone] = {"build": "neutral", "agent": "info"}
FILE_ICONS: Mapping[str, str] = {
    "apk": "smartphone", "aab": "smartphone", "ipa": "smartphone",
    "appimage": "app-window", "exe": "app-window", "msi": "app-window", "dmg": "app-window", "deb": "app-window",
    "rpm": "app-window",
    "zip": "file-archive", "tar": "file-archive", "gz": "file-archive", "tgz": "file-archive", "xz": "file-archive",
    "7z": "file-archive",
    "pdf": "file-pdf", "md": "file-pdf", "txt": "file-pdf",
    "png": "image", "jpg": "image", "jpeg": "image", "gif": "image", "webp": "image", "svg": "image",
    "mp3": "audio", "wav": "audio", "ogg": "audio", "m4a": "audio",
    "html": "file-code", "js": "file-code", "ts": "file-code", "json": "file-code", "css": "file-code", "py": "file-code",
}


def safe_file_name(name: str, fallback: str = "artifact") -> str:
    cleaned = UNSAFE_FILE_CHARS.sub("_", PATH_SEPARATORS.split(name)[-1]).strip().lstrip(".")
    return cleaned or fallback


def file_icon(name: str) -> str:
    extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return FILE_ICONS.get(extension, "file")


def by_project(items: Iterable[T], names: Mapping[str, str]) -> list[tuple[str, str, list[T]]]:
    """Items grouped under their project, keeping the incoming (newest first) order of groups and rows."""
    groups: dict[str, list[T]] = {}
    for item in items:
        groups.setdefault(item.get("projectId") or "", []).append(item)
    return [(pid, names.get(pid, pid) or FILES["no_project"], members) for pid, members in groups.items()]


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


def project_options(artifacts: Iterable[Artifact] | Iterable[BuildOutput] | None, names: Mapping[str, str]) -> list[tuple[str, str]]:
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


SHARED, BUILDS = "shared", "builds"


def view_options() -> list[tuple[str, str]]:
    return [(SHARED, VIEWS["shared"]), (BUILDS, VIEWS["builds"])]


def output_key(output: BuildOutput) -> str:
    return f"{output['projectId']}/{output['path']}"


def output_folder(output: BuildOutput) -> str:
    path, name = output["path"], output["fileName"]
    return path[: max(0, len(path) - len(name) - 1)] or "."


def output_meta(output: BuildOutput, now: float | None = None, project: str | None = None) -> str:
    platform = output.get("platform")
    return join_meta(
        project,
        format_bytes(output.get("sizeBytes")),
        None if platform in (None, "", "file") else platform,
        format_relative_time(output.get("modifiedAt"), now),
    )


def filter_outputs(outputs: Iterable[BuildOutput] | None, project_id: str = ALL) -> list[BuildOutput]:
    ordered = sorted(outputs or [], key=lambda o: parse_iso(o.get("modifiedAt")) or 0.0, reverse=True)
    return [output for output in ordered if not project_id or output.get("projectId") == project_id]


def outputs_subtitle(outputs: Iterable[BuildOutput]) -> str:
    items = list(outputs)
    projects = {o.get("projectId") for o in items}
    return OUTPUTS["subtitle"].format(count=pluralize(len(items), "build"), projects=pluralize(len(projects), "project"))
