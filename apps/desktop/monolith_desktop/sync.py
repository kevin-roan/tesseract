import os
import subprocess
import sys
import tarfile
import tempfile
from collections.abc import Iterator
from pathlib import Path
from typing import BinaryIO

from .api.client import ControllerClient
from .api.errors import ControllerError
from .config.discovery import DiscoveryError, discover_docker, initial_config
from .pages.projects.model import project_id_from_name
from .syncback.manifest import Manifest, build_manifest
from .syncback.state import Link, SyncState, iso, utc_now

GIT_DIR = ".git"


def _git(root: Path, *args: str) -> str | None:
    try:
        result = subprocess.run(["git", "-C", str(root), *args], capture_output=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return result.stdout.decode("utf-8", "surrogateescape")


def collect_files(root: Path) -> Iterator[str]:
    """Paths relative to `root`: tracked and unignored files of a git checkout (plus `.git` at its top), else everything."""
    listed = _git(root, "ls-files", "-z", "--cached", "--others", "--exclude-standard")
    if listed is None:
        for dirpath, dirnames, filenames in os.walk(root):
            base = Path(dirpath).relative_to(root)
            for name in filenames + [d for d in dirnames if (Path(dirpath) / d).is_symlink()]:
                yield str(base / name)
        return
    if (root / GIT_DIR).exists():
        yield GIT_DIR
    for path in dict.fromkeys(filter(None, listed.split("\0"))):
        if os.path.lexists(root / path):
            yield path


def write_archive(root: Path, files: Iterator[str], out: BinaryIO) -> int:
    count = 0
    with tarfile.open(fileobj=out, mode="w:gz") as archive:
        for path in files:
            archive.add(root / path, arcname=path, recursive=path == GIT_DIR)
            count += 1
    return count


def sync_directory(client: ControllerClient, root: Path, project_id: str) -> tuple[dict, bool, int, Manifest]:
    files = list(collect_files(root))
    manifest = build_manifest(root, files)
    with tempfile.TemporaryFile() as archive:
        count = write_archive(root, iter(files), archive)
        size = archive.tell()
        archive.seek(0)
        project, created = client.sync_project(project_id, archive, size)
    return project, created, count, manifest


def connect() -> tuple[ControllerClient, str] | None:
    config = initial_config()
    if config is None:
        try:
            config = discover_docker().config
        except DiscoveryError as error:
            print(f"monolith: no sandbox found: {error}", file=sys.stderr)
            return None
    if config is None or not config.is_valid():
        print("monolith: no sandbox to sync with; open the app and connect first", file=sys.stderr)
        return None
    return ControllerClient(config.api_url, config.token), config.name or config.api_url


def connect_client() -> ControllerClient | None:
    connection = connect()
    return connection[0] if connection else None


def run_sync(cwd: str, state: SyncState | None = None) -> int:
    root = Path(cwd).resolve()
    project_id = project_id_from_name(root.name)
    if not project_id:
        print(f"monolith: cannot derive a project id from {root.name!r}", file=sys.stderr)
        return 1
    connection = connect()
    if connection is None:
        return 1
    client, label = connection
    print(f"Syncing {root} to {project_id} on {label}…", flush=True)
    try:
        project, created, count, manifest = sync_directory(client, root, project_id)
    except (ControllerError, OSError) as error:
        print(f"monolith: sync failed: {error}", file=sys.stderr)
        return 1
    try:
        (state or SyncState()).save_link(Link(project_id, str(root), iso(utc_now()), manifest))
    except OSError as error:
        print(f"monolith: pushed, but could not record the link for sync back: {error}", file=sys.stderr)
    print(f"{'Created' if created else 'Updated'} {project['path']} ({count} entries) · linked for sync back")
    return 0
