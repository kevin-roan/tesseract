import contextlib
import fcntl
import json
import os
import shutil
from collections.abc import Iterator, Mapping
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from .fsutil import fsync_dir, write_atomic
from .manifest import Manifest

STATE_DIR_NAME = "tesseract"
LINKS_FILE = "links.json"
SNAPSHOTS_DIR = "snapshots"
SNAPSHOT_FILE = "snapshot.json"
FILES_DIR = "files"
DISPLACED_DIR = "displaced"
LOCKS_DIR = "locks"
KEEP_SNAPSHOTS = 20
REDACTED = "REDACTED"

Before = Literal["file", "absent"]


def state_dir(env: Mapping[str, str] = os.environ) -> Path:
    base = env.get("XDG_STATE_HOME") or str(Path.home() / ".local" / "state")
    return Path(base) / STATE_DIR_NAME


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(moment: datetime) -> str:
    return moment.isoformat(timespec="milliseconds").replace("+00:00", "Z")


@dataclass
class Link:
    project_id: str
    host_path: str
    pushed_at: str
    manifest: Manifest = field(default_factory=dict)
    executable: list[str] | None = None
    git_manifest: dict[str, str] | None = None
    got_at: str | None = None
    confidential: bool = False

    def to_json(self) -> dict[str, Any]:
        data: dict[str, Any] = {"hostPath": self.host_path, "pushedAt": self.pushed_at, "manifest": self.manifest}
        if self.executable is not None:
            data["executable"] = self.executable
        if self.git_manifest is not None:
            data["gitManifest"] = self.git_manifest
        if self.got_at is not None:
            data["gotAt"] = self.got_at
        if self.confidential:
            data["confidential"] = True
        return data

    @property
    def shared_path(self) -> str:
        return REDACTED if self.confidential else self.host_path

    def redact(self, text: str) -> str:
        if not self.confidential:
            return text
        return text.replace(self.host_path, REDACTED).replace(Path(self.host_path).name, REDACTED)

    @classmethod
    def from_json(cls, project_id: str, data: Any) -> "Link | None":
        if not isinstance(data, dict) or not isinstance(data.get("hostPath"), str):
            return None
        executable = data.get("executable")
        got_at = data.get("gotAt")
        return cls(
            project_id,
            data["hostPath"],
            str(data.get("pushedAt") or ""),
            _strings(data.get("manifest")) or {},
            [p for p in executable if isinstance(p, str)] if isinstance(executable, list) else None,
            _strings(data.get("gitManifest")),
            got_at if isinstance(got_at, str) else None,
            data.get("confidential") is True,
        )


def _strings(value: Any) -> dict[str, str] | None:
    return {k: v for k, v in value.items() if isinstance(k, str) and isinstance(v, str)} if isinstance(value, dict) else None


@dataclass
class SnapshotEntry:
    path: str
    before: Before
    after_sha256: str | None
    # The push-time manifest hash before the pull (None: not in it). A revert puts it back in links.json and in the
    # sandbox baseline, so the reverted change is offered again. `baseline_known` is False for older snapshots.
    manifest_before: str | None = None
    baseline_known: bool = False


@dataclass
class Snapshot:
    id: str
    projectId: str
    hostPath: str
    createdAt: str
    entries: list[SnapshotEntry]
    kind: str = "pull"
    reverted: bool = False
    directory: Path | None = field(default=None, compare=False)

    def to_json(self) -> dict[str, Any]:
        data = asdict(self)
        data.pop("directory")
        for entry in data["entries"]:
            if not entry.pop("baseline_known"):
                entry.pop("manifest_before")
        return data

    @classmethod
    def from_json(cls, data: dict[str, Any], directory: Path) -> "Snapshot":
        return cls(
            id=data["id"],
            projectId=data["projectId"],
            hostPath=data["hostPath"],
            createdAt=data["createdAt"],
            entries=[
                SnapshotEntry(e["path"], e["before"], e.get("after_sha256"), e.get("manifest_before"), "manifest_before" in e)
                for e in data.get("entries", [])
            ],
            kind=data.get("kind", "pull"),
            reverted=bool(data.get("reverted")),
            directory=directory,
        )

    def saved_copy(self, rel: str) -> Path:
        assert self.directory is not None
        return self.directory / FILES_DIR / rel

    def displaced_copy(self, rel: str) -> Path:
        """Where `revert --force` keeps a host edit it overwrote."""
        assert self.directory is not None
        return self.directory / DISPLACED_DIR / rel


class SyncState:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or state_dir()

    @property
    def links_path(self) -> Path:
        return self.root / LINKS_FILE

    def _read_links(self) -> dict[str, Any]:
        try:
            data = json.loads(self.links_path.read_text("utf-8"))
        except (OSError, ValueError):
            return {}
        return data if isinstance(data, dict) else {}

    def links(self) -> dict[str, Link]:
        return {pid: link for pid, raw in self._read_links().items() if (link := Link.from_json(pid, raw))}

    def link(self, project_id: str) -> Link | None:
        return self.links().get(project_id)

    def link_for_path(self, host_path: Path) -> Link | None:
        target = str(host_path)
        return next((link for link in self.links().values() if link.host_path == target), None)

    def save_link(self, link: Link, replaces: str | None = None) -> None:
        with self._links_lock():
            data = self._read_links()
            if replaces is not None:
                data.pop(replaces, None)
            data[link.project_id] = link.to_json()
            self._write_links(data)

    def update_manifest(
        self, project_id: str, changes: Mapping[str, str | None], executable: Mapping[str, bool] | None = None
    ) -> None:
        with self._links_lock():
            data = self._read_links()
            link = Link.from_json(project_id, data.get(project_id))
            if link is None:
                return
            bits = set(link.executable or ())
            for path, digest in changes.items():
                if digest is None:
                    link.manifest.pop(path, None)
                    bits.discard(path)
                else:
                    link.manifest[path] = digest
                if executable and path in executable:
                    (bits.add if executable[path] else bits.discard)(path)
            if link.executable is not None:
                link.executable = sorted(bits)
            data[project_id] = link.to_json()
            self._write_links(data)

    def record_get(
        self, project_id: str, manifest: Manifest, executable: list[str], git_manifest: dict[str, str] | None, got_at: str
    ) -> None:
        """After an applied get: the host tree that was sent becomes the link's baseline (hostPath and pushedAt kept)."""
        with self._links_lock():
            data = self._read_links()
            link = Link.from_json(project_id, data.get(project_id))
            if link is None:
                return
            link.manifest, link.executable, link.git_manifest, link.got_at = dict(manifest), list(executable), git_manifest, got_at
            data[project_id] = link.to_json()
            self._write_links(data)

    def _write_links(self, data: dict[str, Any]) -> None:
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        write_atomic(self.links_path, (json.dumps(data, indent=2) + "\n").encode("utf-8"), 0o600)

    @contextlib.contextmanager
    def _links_lock(self) -> Iterator[None]:
        with self._flock(".links"):
            yield

    @contextlib.contextmanager
    def project_lock(self, project_id: str) -> Iterator[None]:
        with self._flock(project_id):
            yield

    @contextlib.contextmanager
    def _flock(self, name: str) -> Iterator[None]:
        locks = self.root / LOCKS_DIR
        locks.mkdir(parents=True, exist_ok=True, mode=0o700)
        with open(locks / f"{name}.lock", "a") as handle:
            fcntl.flock(handle, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle, fcntl.LOCK_UN)

    def snapshots_dir(self, project_id: str) -> Path:
        return self.root / SNAPSHOTS_DIR / project_id

    def snapshots(self, project_id: str) -> list[Snapshot]:
        """Newest first."""
        base = self.snapshots_dir(project_id)
        found: list[Snapshot] = []
        if not base.is_dir():
            return found
        for directory in base.iterdir():
            try:
                found.append(Snapshot.from_json(json.loads((directory / SNAPSHOT_FILE).read_text("utf-8")), directory))
            except (OSError, ValueError, KeyError, TypeError):
                continue
        return sorted(found, key=lambda s: (s.createdAt, s.id), reverse=True)

    def new_snapshot(self, project_id: str, host_path: str, entries: list[SnapshotEntry]) -> Snapshot:
        moment = utc_now()
        base = self.snapshots_dir(project_id)
        base.mkdir(parents=True, exist_ok=True, mode=0o700)
        stem = moment.astimezone().strftime("%Y%m%d-%H%M%S")
        snapshot_id, n = stem, 1
        while True:
            try:
                (base / snapshot_id).mkdir(mode=0o700)
                break
            except FileExistsError:
                n += 1
                snapshot_id = f"{stem}-{n}"
        return Snapshot(snapshot_id, project_id, host_path, iso(moment), entries, directory=base / snapshot_id)

    def save_snapshot(self, snapshot: Snapshot) -> None:
        assert snapshot.directory is not None
        write_atomic(snapshot.directory / SNAPSHOT_FILE, (json.dumps(snapshot.to_json(), indent=2) + "\n").encode("utf-8"), 0o600)
        fsync_dir(snapshot.directory)

    def discard_snapshot(self, snapshot: Snapshot) -> None:
        if snapshot.directory is not None:
            shutil.rmtree(snapshot.directory, ignore_errors=True)

    def prune(self, project_id: str, keep: int = KEEP_SNAPSHOTS) -> None:
        for snapshot in self.snapshots(project_id)[keep:]:
            self.discard_snapshot(snapshot)
