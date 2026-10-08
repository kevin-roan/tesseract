import io
import logging
import os
import posixpath
import shutil
import tarfile
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from .errors import NotLinked, SyncBackError, SyncConflict
from .fsutil import copy_for_snapshot, exists, file_mode, install, is_executable, make_parents, prune_empty_parents, remove, with_executable
from .manifest import check_relative, hash_path, resolve_inside
from .state import Link, Snapshot, SnapshotEntry, SyncState

log = logging.getLogger(__name__)

KINDS = ("added", "modified", "deleted")


class SyncClient(Protocol):
    def sync_changes(self, project_id: str) -> dict[str, Any]: ...
    def sync_export(self, project_id: str, paths: list[str]) -> bytes: ...
    def sync_ack(self, project_id: str, changes: list[dict[str, Any]]) -> dict[str, Any]: ...


@dataclass
class PullOutcome:
    project_id: str
    host_path: str
    added: list[str] = field(default_factory=list)
    modified: list[str] = field(default_factory=list)
    deleted: list[str] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)
    snapshot_id: str | None = None
    dry_run: bool = False
    warnings: list[str] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.added) + len(self.modified) + len(self.deleted)

    def result(self) -> dict[str, Any]:
        return {
            "added": len(self.added),
            "modified": len(self.modified),
            "deleted": len(self.deleted),
            "conflicts": list(self.conflicts),
            "snapshotId": self.snapshot_id,
            "hostPath": self.host_path,
        }


def require_link(state: SyncState, project_id: str) -> Link:
    link = state.link(project_id)
    if link is None:
        raise NotLinked(project_id)
    if not Path(link.host_path).is_dir():
        raise SyncBackError(f"{link.host_path} no longer exists. Run tesseract --sync in the checkout again")
    return link


def is_conflict(target: Path, expected: str | None, incoming: str | None) -> bool:
    current = hash_path(target)
    return current != expected and current != incoming


def pull(
    client: SyncClient,
    state: SyncState,
    project_id: str,
    paths: list[str] | None = None,
    force: bool = False,
    dry_run: bool = False,
) -> PullOutcome:
    link = require_link(state, project_id)
    root = Path(link.host_path).resolve()
    with state.project_lock(project_id):
        data = client.sync_changes(project_id)
        if data.get("baselineAt") is None:
            raise SyncBackError(f"{project_id} was never pushed. Run tesseract --sync in the checkout first")
        changes = list(data.get("changes") or [])
        if paths is not None:
            wanted = set(paths)
            changes = [change for change in changes if change["path"] in wanted]
        outcome = PullOutcome(project_id, str(root), dry_run=dry_run)
        targets = {change["path"]: resolve_inside(root, change["path"]) for change in changes}
        for change in changes:
            if change.get("kind") not in KINDS:
                raise SyncBackError(f"Unknown change kind {change.get('kind')!r} for {change['path']}")
            getattr(outcome, change["kind"]).append(change["path"])
            if is_conflict(targets[change["path"]], link.manifest.get(change["path"]), change.get("sha256")):
                outcome.conflicts.append(change["path"])
        if not changes or dry_run:
            return outcome
        if outcome.conflicts and not force:
            raise SyncConflict(outcome.conflicts)
        written, executable = _apply(client, state, link, root, changes, targets, outcome)
        state.update_manifest(project_id, written, executable)
        try:
            client.sync_ack(project_id, [_ack(path, digest, executable.get(path)) for path, digest in written.items()])
        except Exception as error:  # noqa: BLE001
            log.warning("sync ack failed: %s", error)
            outcome.warnings.append(f"The files were written, but the sandbox did not record it ({error}); they may be offered again")
        state.prune(project_id)
        return outcome


def _ack(path: str, digest: str | None, executable: bool | None) -> dict[str, Any]:
    change: dict[str, Any] = {"path": path, "sha256": digest}
    if digest is not None and executable is not None:
        change["executable"] = executable
    return change


def _apply(
    client: SyncClient,
    state: SyncState,
    link: Link,
    root: Path,
    changes: list[dict[str, Any]],
    targets: dict[str, Path],
    outcome: PullOutcome,
) -> tuple[dict[str, str | None], dict[str, bool]]:
    """Write the changes; returns the hashes written (None: deleted) and the executable bit of each written file."""
    incoming = [change["path"] for change in changes if change["kind"] != "deleted"]
    deletes = [change["path"] for change in changes if change["kind"] == "deleted"]
    with tempfile.TemporaryDirectory(prefix="tesseract-pull-") as temp:
        staged = extract_export(client.sync_export(link.project_id, incoming), set(incoming), Path(temp)) if incoming else {}
        written: dict[str, str | None] = {path: hash_path(staged[path]) for path in incoming}
        written.update({path: None for path in deletes})
        executable = {path: is_executable(staged[path]) for path in incoming}
        snapshot = take_snapshot(state, link.project_id, root, targets, written, link.manifest)
        outcome.snapshot_id = snapshot.id
        created: list[Path] = []
        try:
            for path in deletes:
                remove(targets[path])
                prune_empty_parents(root, targets[path])
            for path in incoming:
                target = targets[path]
                make_parents(root, target, created)
                host_mode = file_mode(target)
                # Keep the host's permissions, but take the sandbox's executable bit (chmod +x there is a change too).
                install(staged[path], target, None if host_mode is None else with_executable(host_mode, executable[path]))
        except Exception as error:
            _rollback(state, root, snapshot, targets, created, error)
    return written, executable


def take_snapshot(
    state: SyncState,
    project_id: str,
    root: Path,
    targets: dict[str, Path],
    after: dict[str, str | None],
    manifest: dict[str, str],
) -> Snapshot:
    entries = [
        SnapshotEntry(path, "file" if exists(targets[path]) else "absent", after[path], manifest.get(path), True) for path in after
    ]
    snapshot = state.new_snapshot(project_id, str(root), entries)
    try:
        for entry in entries:
            if entry.before == "file":
                copy_for_snapshot(targets[entry.path], snapshot.saved_copy(entry.path))
        state.save_snapshot(snapshot)
    except Exception as error:
        state.discard_snapshot(snapshot)
        raise SyncBackError(f"Could not save the snapshot, nothing was written: {error}") from error
    return snapshot


def _rollback(
    state: SyncState, root: Path, snapshot: Snapshot, targets: dict[str, Path], created: list[Path], cause: Exception
) -> None:
    problems: list[str] = []
    for entry in snapshot.entries:
        if entry.before == "absent":
            try:
                remove(targets[entry.path])
            except OSError as error:
                problems.append(f"{entry.path}: {error}")
    for directory in reversed(created):
        try:
            directory.rmdir()
        except OSError:
            pass
    for entry in snapshot.entries:
        if entry.before == "file":
            try:
                make_parents(root, targets[entry.path], [])
                install(snapshot.saved_copy(entry.path), targets[entry.path])
            except OSError as error:
                problems.append(f"{entry.path}: {error}")
    if problems:
        raise SyncBackError(
            f"Sync failed ({cause}) and the rollback was incomplete ({'; '.join(problems)}). "
            f"Copies of the original files are in {snapshot.directory}"
        ) from cause
    state.discard_snapshot(snapshot)
    raise SyncBackError(f"Sync failed, nothing was changed: {cause}") from cause


def _member_name(member: tarfile.TarInfo) -> str:
    name = member.name
    while name.startswith("./"):
        name = name[2:]
    return name.rstrip("/") if member.isdir() else name


def extract_export(data: bytes, wanted: set[str], dest: Path) -> dict[str, Path]:
    """Extract the export tar into `dest`, accepting only the requested regular files and in-tree symlinks."""
    staged: dict[str, Path] = {}
    try:
        archive = tarfile.open(fileobj=io.BytesIO(data), mode="r:*")
    except tarfile.TarError as error:
        raise SyncBackError(f"The sandbox sent an unreadable archive: {error}") from error
    with archive:
        for member in archive:
            name = _member_name(member)
            if member.isdir():
                if name:
                    check_relative(name)
                continue
            check_relative(name)
            if name not in wanted:
                raise SyncBackError(f"The sandbox sent an unexpected file: {name}")
            if name in staged:
                raise SyncBackError(f"The sandbox sent {name} twice")
            target = dest / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if member.issym():
                link = member.linkname
                resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), link))
                if not link or posixpath.isabs(link) or resolved == ".." or resolved.startswith("../"):
                    raise SyncBackError(f"Refusing symlink {name} -> {link}: it points outside the project")
                os.symlink(link, target)
            elif member.isreg():
                source = archive.extractfile(member)
                if source is None:
                    raise SyncBackError(f"Could not read {name} from the archive")
                with source, open(target, "wb") as out:
                    shutil.copyfileobj(source, out)
                os.chmod(target, (member.mode & 0o777) | 0o600)
            else:
                raise SyncBackError(f"Refusing {name}: only regular files and symlinks can be synced")
            staged[name] = target
    missing = sorted(wanted - staged.keys())
    if missing:
        raise SyncBackError(f"The sandbox archive is missing {', '.join(missing[:5])}")
    return staged
