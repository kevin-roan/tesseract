import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from .errors import SyncBackError, SyncConflict
from .fsutil import copy_for_snapshot, exists, install, is_executable, make_parents, prune_empty_parents, remove
from .manifest import hash_path, resolve_inside
from .state import SyncState

log = logging.getLogger(__name__)


class AckClient(Protocol):
    def sync_ack(self, project_id: str, changes: list[dict[str, Any]]) -> dict[str, Any]: ...


@dataclass
class RevertOutcome:
    project_id: str
    host_path: str
    snapshot_id: str
    restored: list[str] = field(default_factory=list)
    recreated: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)
    # Host edits overwritten by --force, and where their copies were kept.
    displaced: list[str] = field(default_factory=list)
    displaced_dir: str | None = None
    # Sandbox baseline entries to put back (a SyncAck body) so the reverted changes are offered again.
    baseline: list[dict[str, Any]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def total(self) -> int:
        return len(self.restored) + len(self.recreated) + len(self.removed)

    def result(self) -> dict[str, Any]:
        return {
            "added": len(self.recreated),
            "modified": len(self.restored),
            "deleted": len(self.removed),
            "conflicts": list(self.conflicts),
            "snapshotId": self.snapshot_id,
            "hostPath": self.host_path,
        }


def revert(state: SyncState, project_id: str, force: bool = False) -> RevertOutcome:
    """Undo the newest pull that has not been reverted yet (host files and links.json; see `restore_baseline`)."""
    with state.project_lock(project_id):
        snapshot = next((s for s in state.snapshots(project_id) if not s.reverted), None)
        if snapshot is None:
            raise SyncBackError(f"There is no sync to revert for {project_id}")
        root = Path(snapshot.hostPath).resolve()
        if not root.is_dir():
            raise SyncBackError(f"{root} no longer exists")
        targets = {entry.path: resolve_inside(root, entry.path) for entry in snapshot.entries}
        outcome = RevertOutcome(project_id, str(root), snapshot.id)
        outcome.conflicts = [e.path for e in snapshot.entries if hash_path(targets[e.path]) != e.after_sha256]
        if outcome.conflicts and not force:
            raise SyncConflict(outcome.conflicts, "revert")
        for path in outcome.conflicts:
            if exists(targets[path]):
                copy_for_snapshot(targets[path], snapshot.displaced_copy(path))
                outcome.displaced.append(path)
        if outcome.displaced:
            outcome.displaced_dir = str(snapshot.displaced_copy(""))
        for entry in sorted(snapshot.entries, key=lambda e: e.before == "file"):
            target = targets[entry.path]
            if entry.before == "file":
                make_parents(root, target, [])
                install(snapshot.saved_copy(entry.path), target)
                (outcome.recreated if entry.after_sha256 is None else outcome.restored).append(entry.path)
            else:
                remove(target)
                prune_empty_parents(root, target)
                outcome.removed.append(entry.path)
        known = [entry for entry in snapshot.entries if entry.baseline_known]
        state.update_manifest(project_id, {entry.path: entry.manifest_before for entry in known})
        for entry in known:
            change: dict[str, Any] = {"path": entry.path, "sha256": entry.manifest_before}
            if entry.manifest_before is not None and hash_path(targets[entry.path]) == entry.manifest_before:
                change["executable"] = is_executable(targets[entry.path])
            outcome.baseline.append(change)
        snapshot.reverted = True
        state.save_snapshot(snapshot)
        return outcome


def restore_baseline(client: AckClient | None, outcome: RevertOutcome) -> None:
    """Put the sandbox baseline back to before the pull, so its changes are offered again. Best effort."""
    if not outcome.baseline:
        return
    if client is None:
        outcome.warnings.append("The sandbox was not reachable, so it will not offer the reverted changes again")
        return
    try:
        client.sync_ack(outcome.project_id, outcome.baseline)
    except Exception as error:  # noqa: BLE001
        log.warning("sync baseline restore failed: %s", error)
        outcome.warnings.append(f"The sandbox did not record the revert ({error}); it will not offer those changes again")
