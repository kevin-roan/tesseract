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
from .pseudonym import pseudonym
from .syncback.manifest import GIT_DIR
from .syncback.state import Link, SyncState, iso, utc_now
from .syncback.tree import HostTree, collect_files, scan_tree


def write_archive(root: Path, files: Iterator[str], out: BinaryIO) -> int:
    count = 0
    with tarfile.open(fileobj=out, mode="w:gz") as archive:
        for path in files:
            archive.add(root / path, arcname=path, recursive=path == GIT_DIR)
            count += 1
    return count


def sync_directory(
    client: ControllerClient, root: Path, project_id: str, confidential: bool = False
) -> tuple[dict, bool, int, HostTree]:
    files = list(collect_files(root))
    tree = scan_tree(root, files)
    with tempfile.TemporaryFile() as archive:
        count = write_archive(root, iter(files), archive)
        size = archive.tell()
        archive.seek(0)
        project, created = client.sync_project(project_id, archive, size, confidential)
    return project, created, count, tree


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


def sandbox_project_ids(client: ControllerClient) -> list[str]:
    try:
        return [project["id"] for project in client.list_projects()]
    except (ControllerError, OSError, KeyError, TypeError):
        return []


def run_sync(cwd: str, state: SyncState | None = None, confidential: bool = False) -> int:
    root = Path(cwd).resolve()
    state = state or SyncState()
    link = state.link_for_path(root)
    replaces = None
    if link is not None and confidential and not link.confidential:
        replaces, link = link.project_id, None
    if link is not None:
        project_id, confidential = link.project_id, link.confidential
    else:
        project_id = None if confidential else project_id_from_name(root.name)
    if not project_id and not confidential:
        print(f"monolith: cannot derive a project id from {root.name!r}", file=sys.stderr)
        return 1
    connection = connect()
    if connection is None:
        return 1
    client, label = connection
    if not project_id:
        project_id = pseudonym([*state.links(), *sandbox_project_ids(client)])
    print(f"Syncing {root} to {project_id}{' (confidential)' if confidential else ''} on {label}…", flush=True)
    try:
        project, created, count, tree = sync_directory(client, root, project_id, confidential)
    except (ControllerError, OSError) as error:
        print(f"monolith: sync failed: {error}", file=sys.stderr)
        return 1
    try:
        state.save_link(
            Link(project_id, str(root), iso(utc_now()), tree.manifest, tree.executable, tree.git, confidential=confidential),
            replaces,
        )
    except OSError as error:
        print(f"monolith: pushed, but could not record the link for sync back: {error}", file=sys.stderr)
    print(f"{'Created' if created else 'Updated'} {project['path']} ({count} entries) · linked for sync back")
    if replaces:
        print(
            f"monolith: the earlier copy {replaces} is still in the sandbox under its real name and is no longer linked;"
            f" remove it there with: rm -rf /workspace/projects/{replaces}",
            file=sys.stderr,
        )
    return 0
