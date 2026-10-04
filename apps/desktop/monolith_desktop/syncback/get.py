import tarfile
import tempfile
from pathlib import Path
from typing import Any, BinaryIO, Protocol

from .errors import SyncBackError
from .manifest import GIT_DIR
from .pull import require_link
from .state import REDACTED, Link, SyncState, iso, utc_now
from .tree import GitManifest, HostTree, collect_files, scan_tree

MAX_CHANGES = 5000
MAX_GIT_PATHS = 200_000


class GetClient(Protocol):
    def sync_get_plan(self, request_id: str, plan: dict[str, Any]) -> dict[str, Any]: ...
    def sync_get_apply(self, request_id: str, archive: BinaryIO, size: int) -> dict[str, Any]: ...


def too_many(what: str, root: Path) -> SyncBackError:
    return SyncBackError(f"Too many {what} changed on the host for a get. Run monolith --sync in {root} instead")


def plan_changes(tree: HostTree, link: Link) -> list[dict[str, Any]]:
    """Host files added, modified (content, or the executable bit when the link knows it) or deleted since the last push/get."""
    executable = set(tree.executable)
    known = set(link.executable) if link.executable is not None else None
    changes = []
    for path in sorted(tree.manifest.keys() | link.manifest.keys()):
        digest, before = tree.manifest.get(path), link.manifest.get(path)
        if digest is None:
            changes.append({"path": path, "kind": "deleted", "sha256": None, "executable": False})
        elif before is None or before != digest or (known is not None and (path in known) != (path in executable)):
            kind = "added" if before is None else "modified"
            changes.append({"path": path, "kind": kind, "sha256": digest, "executable": path in executable})
    return changes


def plan_git(current: GitManifest | None, previous: GitManifest | None) -> dict[str, list[str]] | None:
    if current is None:
        return None
    previous = previous or {}
    return {
        "changed": sorted(path for path, stamp in current.items() if previous.get(path) != stamp),
        "deleted": sorted(previous.keys() - current.keys()),
    }


def get(client: GetClient, state: SyncState, request: dict[str, Any]) -> dict[str, Any]:
    """Send the linked checkout's changes since the last push/get to the sandbox; returns the request, applied or failed."""
    project_id = request["projectId"]
    link = require_link(state, project_id)
    root = Path(link.host_path).resolve()
    with state.project_lock(project_id):
        tree = scan_tree(root, collect_files(root))
        changes = plan_changes(tree, link)
        if len(changes) > MAX_CHANGES:
            raise too_many("files", root)
        git = plan_git(tree.git, link.git_manifest)
        if git is not None and max(len(git["changed"]), len(git["deleted"])) > MAX_GIT_PATHS:
            raise too_many(".git files", root)
        host_path = REDACTED if link.confidential else str(root)
        planned = client.sync_get_plan(request["id"], {"hostPath": host_path, "changes": changes, "git": git})
        if planned["request"]["status"] == "failed":
            return planned["request"]
        sendable = {change["path"] for change in changes if change["kind"] != "deleted"}
        upload, git_upload = list(planned.get("upload") or []), list(planned.get("gitUpload") or [])
        _check_subset(upload, sendable, "file")
        _check_subset(git_upload, set(git["changed"]) if git else set(), ".git file")
        with tempfile.TemporaryFile() as archive:
            write_get_archive(root, upload, git_upload, archive)
            size = archive.tell()
            archive.seek(0)
            done = client.sync_get_apply(request["id"], archive, size)
        if done["status"] == "applied":
            got_at = (done.get("result") or {}).get("syncedAt") or iso(utc_now())
            state.record_get(project_id, tree.manifest, tree.executable, tree.git, got_at)
        elif done["status"] != "failed":
            raise SyncBackError(f"The sandbox left the get {done['status']}")
        return done


def _check_subset(paths: list[str], allowed: set[str], what: str) -> None:
    unexpected = [path for path in paths if path not in allowed]
    if unexpected:
        raise SyncBackError(f"The sandbox asked for an unplanned {what}: {unexpected[0]}")


def write_get_archive(root: Path, upload: list[str], git_upload: list[str], out: BinaryIO) -> None:
    entries = [(root / path, path) for path in upload] + [(root / GIT_DIR / path, f"{GIT_DIR}/{path}") for path in git_upload]
    with tarfile.open(fileobj=out, mode="w:gz") as archive:
        for source, name in entries:
            try:
                archive.add(source, arcname=name, recursive=False)
            except FileNotFoundError as error:
                raise SyncBackError(f"{name} changed during the sync, run monolith --get again") from error
