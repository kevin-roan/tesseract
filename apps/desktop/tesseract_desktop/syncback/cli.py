import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any, TextIO

from ..api.errors import ControllerError
from .errors import NotLinked, SyncBackError, SyncConflict
from .manifest import resolve_inside
from .pull import PullOutcome, is_conflict, pull
from .revert import restore_baseline, revert
from .state import Link, SyncState
from .summary import describe_pull, describe_revert, plural

EXIT_OK, EXIT_ERROR, EXIT_CONFLICT = 0, 1, 2
KIND_CODES = {"added": "A", "modified": "M", "deleted": "D"}
MAX_LISTED = 50
GET_IN_SANDBOX = "tesseract --get runs inside the sandbox (in /workspace/projects/<id>); on this computer use tesseract --sync"

ClientFactory = Callable[[], Any]


def resolve_link(state: SyncState, cwd: str, project_id_from_name: Callable[[str], str | None]) -> Link:
    root = Path(cwd).resolve()
    link = state.link_for_path(root)
    if link is not None:
        return link
    project_id = project_id_from_name(root.name) or root.name
    existing = state.link(project_id)
    if existing is not None:
        raise SyncBackError(f"{project_id} is linked to {existing.host_path}, not {root}. Run tesseract --sync here to relink it")
    raise NotLinked(project_id)


def _list(paths: list[str], out: TextIO, prefix: str = "  ") -> None:
    for path in paths[:MAX_LISTED]:
        print(f"{prefix}{path}", file=out)
    if len(paths) > MAX_LISTED:
        print(f"{prefix}… and {len(paths) - MAX_LISTED} more", file=out)


def _conflicts(conflicts: list[str], action: str, err: TextIO) -> int:
    print(f"tesseract: {plural(len(conflicts), 'file')} changed on the host since the last {action}:", file=err)
    _list(conflicts, err)
    if action == "push":
        print("Nothing was written. Re-run with --force to overwrite them (a snapshot is still taken).", file=err)
    else:
        print("Nothing was reverted. Re-run with --force to revert anyway (copies of those host edits are kept).", file=err)
    return EXIT_CONFLICT


def run_pull(
    cwd: str,
    client_factory: ClientFactory,
    project_id_from_name: Callable[[str], str | None],
    dry_run: bool = False,
    force: bool = False,
    state: SyncState | None = None,
    out: TextIO | None = None,
    err: TextIO | None = None,
) -> int:
    state = state or SyncState()
    out, err = out or sys.stdout, err or sys.stderr
    try:
        link = resolve_link(state, cwd, project_id_from_name)
        client = client_factory()
        if client is None:
            return EXIT_ERROR
        outcome = pull(client, state, link.project_id, force=force, dry_run=dry_run)
    except SyncConflict as error:
        return _conflicts(error.conflicts, "push", err)
    except (SyncBackError, ControllerError, OSError) as error:
        print(f"tesseract: pull failed: {error}", file=err)
        return EXIT_ERROR
    print(describe_pull(outcome), file=out)
    if dry_run:
        _print_plan(outcome, out)
        if outcome.conflicts and not force:
            return _conflicts(outcome.conflicts, "push", err)
    elif outcome.conflicts:
        print(f"Overwrote {plural(len(outcome.conflicts), 'host edit')} (--force); the originals are in the snapshot", file=out)
    for warning in outcome.warnings:
        print(f"tesseract: warning: {warning}", file=err)
    return EXIT_OK


def _print_plan(outcome: PullOutcome, out: TextIO) -> None:
    rows = [(KIND_CODES[k], path) for k in KIND_CODES for path in getattr(outcome, k)]
    conflicts = set(outcome.conflicts)
    for code, path in rows[:MAX_LISTED]:
        print(f"  {code} {path}{'  (changed on host)' if path in conflicts else ''}", file=out)
    if len(rows) > MAX_LISTED:
        print(f"  … and {len(rows) - MAX_LISTED} more", file=out)


def run_revert(
    cwd: str,
    project_id_from_name: Callable[[str], str | None],
    force: bool = False,
    state: SyncState | None = None,
    out: TextIO | None = None,
    err: TextIO | None = None,
    client_factory: ClientFactory | None = None,
) -> int:
    state = state or SyncState()
    out, err = out or sys.stdout, err or sys.stderr
    try:
        link = resolve_link(state, cwd, project_id_from_name)
        outcome = revert(state, link.project_id, force)
    except SyncConflict as error:
        return _conflicts(error.conflicts, "sync", err)
    except (SyncBackError, OSError) as error:
        print(f"tesseract: revert failed: {error}", file=err)
        return EXIT_ERROR
    if outcome.baseline:
        restore_baseline(client_factory() if client_factory else None, outcome)
    print(describe_revert(outcome), file=out)
    if outcome.displaced:
        print(f"Overwrote {plural(len(outcome.displaced), 'host edit')} (--force); copies are in {outcome.displaced_dir}", file=out)
    for warning in outcome.warnings:
        print(f"tesseract: warning: {warning}", file=err)
    remaining = [s for s in state.snapshots(link.project_id) if not s.reverted]
    if remaining:
        print(f"Run tesseract --revert again to undo snapshot {remaining[0].id} too", file=out)
    return EXIT_OK


def run_get_on_host(err: TextIO | None = None) -> int:
    print(GET_IN_SANDBOX, file=err or sys.stderr)
    return EXIT_ERROR


def run_status(
    cwd: str,
    client_factory: ClientFactory,
    project_id_from_name: Callable[[str], str | None],
    state: SyncState | None = None,
    out: TextIO | None = None,
    err: TextIO | None = None,
) -> int:
    state = state or SyncState()
    out, err = out or sys.stdout, err or sys.stderr
    try:
        link = resolve_link(state, cwd, project_id_from_name)
    except SyncBackError as error:
        print(f"tesseract: {error}", file=err)
        return EXIT_ERROR
    print(f"{link.project_id} ↔ {link.host_path} · pushed {link.pushed_at or 'never'} · got {link.got_at or 'never'}", file=out)
    code = EXIT_OK
    client = client_factory()
    if client is None:
        code = EXIT_ERROR
    else:
        try:
            _print_changes(client.sync_changes(link.project_id), link, out)
        except (ControllerError, SyncBackError, OSError) as error:
            print(f"tesseract: could not read sandbox changes: {error}", file=err)
            code = EXIT_ERROR
    snapshots = state.snapshots(link.project_id)
    print(f"Snapshots ({len(snapshots)}):" if snapshots else "No snapshots yet", file=out)
    for snapshot in snapshots:
        mark = "  reverted" if snapshot.reverted else ""
        print(f"  {snapshot.id}  {plural(len(snapshot.entries), 'file')}{mark}", file=out)
    return code


def _print_changes(data: dict[str, Any], link: Link, out: TextIO) -> None:
    if data.get("baselineAt") is None:
        print("The sandbox has no push baseline yet; run tesseract --sync", file=out)
        return
    changes = data.get("changes") or []
    if not changes:
        print("No sandbox changes to pull", file=out)
        return
    print(f"Sandbox changes ({len(changes)}):", file=out)
    root = Path(link.host_path)
    for change in changes[:MAX_LISTED]:
        path = change["path"]
        try:
            conflict = is_conflict(resolve_inside(root, path), link.manifest.get(path), change.get("sha256"))
        except SyncBackError:
            conflict = True
        print(f"  {KIND_CODES.get(change['kind'], '?')} {path}{'  (changed on host)' if conflict else ''}", file=out)
    if len(changes) > MAX_LISTED:
        print(f"  … and {len(changes) - MAX_LISTED} more", file=out)
    print("Run tesseract --pull to copy them here", file=out)
