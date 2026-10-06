import io
import os
import tarfile
from pathlib import Path

import pytest

from monolith_desktop.api.errors import ApiError
from monolith_desktop.syncback import SyncBackError, SyncConflict, SyncState
from monolith_desktop.syncback import pull as pull_module
from monolith_desktop.syncback.pull import pull
from monolith_desktop.syncback.revert import restore_baseline, revert
from monolith_desktop.syncback.cli import EXIT_CONFLICT, EXIT_ERROR, EXIT_OK, run_pull, run_revert, run_status
from monolith_desktop.syncback.manifest import build_manifest, hash_path
from monolith_desktop.syncback.requests import claimable, handle_request
from monolith_desktop.syncback.state import Link

PROJECT = "demo"


def walk(root: Path) -> list[str]:
    found = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d != ".git"]
        base = Path(dirpath).relative_to(root)
        found += [(base / name).as_posix() for name in filenames]
    return found


def tree(root: Path) -> dict[str, bytes]:
    return {path: (root / path).read_bytes() for path in sorted(walk(root))}


def write(root: Path, rel: str, text: str) -> None:
    (root / rel).parent.mkdir(parents=True, exist_ok=True)
    (root / rel).write_text(text)


class FakeController:
    """The §3 sync endpoints over a sandbox directory, with a baseline taken at push time."""

    def __init__(self, sandbox: Path) -> None:
        self.sandbox = sandbox
        self.baseline: dict[str, str] | None = None
        self.acks: list[list[dict]] = []
        self.export_override: bytes | None = None
        self.requests: dict[str, dict] = {}
        self.heartbeats: list[tuple[str, list[str], dict[str, int] | None]] = []

    def push(self) -> None:
        self.baseline = build_manifest(self.sandbox, walk(self.sandbox))

    def sync_changes(self, project_id: str) -> dict:
        assert project_id == PROJECT
        if self.baseline is None:
            return {"projectId": project_id, "baselineAt": None, "changes": [], "totalBytes": 0, "host": None}
        current = build_manifest(self.sandbox, walk(self.sandbox))
        changes = []
        for path in sorted(set(current) | set(self.baseline)):
            before, after = self.baseline.get(path), current.get(path)
            if before == after:
                continue
            kind = "added" if before is None else "deleted" if after is None else "modified"
            size = (self.sandbox / path).stat().st_size if after else None
            changes.append({"path": path, "kind": kind, "sha256": after, "size": size})
        total = sum(c["size"] or 0 for c in changes)
        return {"projectId": project_id, "baselineAt": "2026-09-30T20:00:00.000Z", "changes": changes, "totalBytes": total, "host": None}

    def sync_export(self, project_id: str, paths: list[str]) -> bytes:
        if self.export_override is not None:
            return self.export_override
        out = io.BytesIO()
        with tarfile.open(fileobj=out, mode="w:gz") as archive:
            for path in paths:
                archive.add(self.sandbox / path, arcname=path, recursive=False)
        return out.getvalue()

    def sync_ack(self, project_id: str, changes: list[dict]) -> dict:
        self.acks.append(changes)
        for change in changes:
            if change["sha256"] is None:
                self.baseline.pop(change["path"], None)
            else:
                self.baseline[change["path"]] = change["sha256"]
        return self.sync_changes(project_id)

    def add_request(self, kind: str, force: bool = False, paths=None) -> dict:
        request = {"id": f"sync_{len(self.requests) + 1}", "projectId": PROJECT, "kind": kind, "status": "pending",
                   "paths": paths, "force": force, "source": "mobile", "claimedBy": None, "result": None, "error": None}
        self.requests[request["id"]] = request
        return request

    def claim_sync_request(self, request_id: str, host: str) -> dict:
        request = self.requests[request_id]
        if request["status"] != "pending":
            raise ApiError(409, "conflict", "not pending")
        request.update(status="claimed", claimedBy=host)
        return dict(request)

    def complete_sync_request(self, request_id: str, status: str, result=None, error=None) -> dict:
        request = self.requests[request_id]
        assert request["status"] == "claimed"
        request.update(status=status, result=result, error=error)
        return dict(request)


@pytest.fixture
def env(tmp_path):
    host = tmp_path / "host" / PROJECT
    sandbox = tmp_path / "sandbox"
    for root in (host, sandbox):
        write(root, "README.md", "hello\n")
        write(root, "src/app.py", "print('v1')\n")
        write(root, "src/old.py", "old\n")
    (host / ".git").mkdir()
    write(host, ".git/config", "[core]\n")
    state = SyncState(tmp_path / "state")
    state.save_link(Link(PROJECT, str(host.resolve()), "2026-09-30T20:00:00.000Z", build_manifest(host, walk(host))))
    controller = FakeController(sandbox)
    controller.push()
    return host, sandbox, state, controller


def sandbox_edits(sandbox: Path) -> None:
    write(sandbox, "src/app.py", "print('v2')\n")
    write(sandbox, "src/new/feature.py", "new\n")
    (sandbox / "src/old.py").unlink()


def test_pull_applies_changes_takes_snapshot_and_acks(env):
    host, sandbox, state, controller = env
    before = tree(host)
    sandbox_edits(sandbox)
    outcome = pull(controller, state, PROJECT)
    assert (outcome.added, outcome.modified, outcome.deleted) == (["src/new/feature.py"], ["src/app.py"], ["src/old.py"])
    assert tree(host) == tree(sandbox)
    assert (host / ".git/config").read_text() == "[core]\n"
    assert controller.sync_changes(PROJECT)["changes"] == []
    assert {a["path"]: a["sha256"] for a in controller.acks[0]} == {
        "src/new/feature.py": hash_path(sandbox / "src/new/feature.py"),
        "src/app.py": hash_path(sandbox / "src/app.py"),
        "src/old.py": None,
    }
    link = state.link(PROJECT)
    assert link.manifest["src/app.py"] == hash_path(host / "src/app.py") and "src/old.py" not in link.manifest
    snapshot = state.snapshots(PROJECT)[0]
    assert snapshot.id == outcome.snapshot_id and not snapshot.reverted
    assert {e.path: e.before for e in snapshot.entries} == {"src/new/feature.py": "absent", "src/app.py": "file", "src/old.py": "file"}
    assert snapshot.saved_copy("src/app.py").read_bytes() == before["src/app.py"]
    assert outcome.result()["snapshotId"] == outcome.snapshot_id


def test_revert_restores_modified_added_and_deleted(env):
    host, sandbox, state, controller = env
    before = tree(host)
    sandbox_edits(sandbox)
    pull(controller, state, PROJECT)
    outcome = revert(state, PROJECT)
    assert tree(host) == before
    assert not (host / "src/new").exists()
    assert (outcome.restored, outcome.recreated, outcome.removed) == (["src/app.py"], ["src/old.py"], ["src/new/feature.py"])
    assert state.snapshots(PROJECT)[0].reverted
    with pytest.raises(SyncBackError, match="no sync to revert"):
        revert(state, PROJECT)


def test_conflict_aborts_before_writing(env):
    host, sandbox, state, controller = env
    write(host, "src/app.py", "print('host edit')\n")
    write(host, "src/new/feature.py", "host created this\n")
    sandbox_edits(sandbox)
    before = tree(host)
    with pytest.raises(SyncConflict) as error:
        pull(controller, state, PROJECT)
    assert error.value.conflicts == ["src/app.py", "src/new/feature.py"]
    assert tree(host) == before
    assert state.snapshots(PROJECT) == [] and controller.acks == []


def test_same_change_on_both_sides_is_not_a_conflict(env):
    host, sandbox, state, controller = env
    write(host, "src/app.py", "print('v2')\n")
    write(sandbox, "src/app.py", "print('v2')\n")
    outcome = pull(controller, state, PROJECT)
    assert outcome.conflicts == [] and outcome.modified == ["src/app.py"]


def test_force_overwrites_and_revert_brings_the_host_edit_back(env):
    host, sandbox, state, controller = env
    write(host, "src/app.py", "print('host edit')\n")
    sandbox_edits(sandbox)
    outcome = pull(controller, state, PROJECT, force=True)
    assert outcome.conflicts == ["src/app.py"]
    assert (host / "src/app.py").read_text() == "print('v2')\n"
    revert(state, PROJECT)
    assert (host / "src/app.py").read_text() == "print('host edit')\n"


def test_rollback_on_mid_apply_failure(env, monkeypatch):
    host, sandbox, state, controller = env
    write(sandbox, "a.txt", "a\n")
    write(sandbox, "b/c.txt", "c\n")
    write(sandbox, "src/app.py", "print('v2')\n")
    (sandbox / "src/old.py").unlink()
    before = tree(host)
    real_install = pull_module.install
    calls = []

    def flaky(source, target, mode=None):
        calls.append(target)
        if len(calls) == 3:
            raise OSError("disk full")
        real_install(source, target, mode)

    monkeypatch.setattr(pull_module, "install", flaky)
    with pytest.raises(SyncBackError, match="nothing was changed"):
        pull(controller, state, PROJECT)
    monkeypatch.setattr(pull_module, "install", real_install)
    assert tree(host) == before
    assert not (host / "b").exists()
    assert state.snapshots(PROJECT) == [] and controller.acks == []
    assert state.link(PROJECT).manifest["src/app.py"] == hash_path(host / "src/app.py")


def tar_with(*members) -> bytes:
    out = io.BytesIO()
    with tarfile.open(fileobj=out, mode="w:gz") as archive:
        for info, data in members:
            archive.addfile(info, io.BytesIO(data) if data is not None else None)
    return out.getvalue()


def file_member(name: str, data: bytes = b"x") -> tuple[tarfile.TarInfo, bytes]:
    info = tarfile.TarInfo(name)
    info.size = len(data)
    return info, data


def special_member(name: str, kind: bytes, linkname: str = "") -> tuple[tarfile.TarInfo, None]:
    info = tarfile.TarInfo(name)
    info.type = kind
    info.linkname = linkname
    return info, None


@pytest.mark.parametrize("member, message", [
    (file_member("../escape.txt"), "plain relative path"),
    (file_member("/tmp/abs.txt"), "absolute"),
    (file_member("src/other.py"), "unexpected"),
    (special_member("src/app.py", tarfile.SYMTYPE, "../../../etc/passwd"), "outside the project"),
    (special_member("src/app.py", tarfile.SYMTYPE, "/etc/passwd"), "outside the project"),
    (special_member("src/app.py", tarfile.LNKTYPE, "README.md"), "only regular files"),
    (special_member("src/app.py", tarfile.CHRTYPE), "only regular files"),
    (special_member("src/app.py", tarfile.FIFOTYPE), "only regular files"),
])
def test_export_tar_with_unsafe_entries_is_rejected(env, member, message):
    host, sandbox, state, controller = env
    write(sandbox, "src/app.py", "print('v2')\n")
    controller.export_override = tar_with(member)
    before = tree(host)
    with pytest.raises(SyncBackError, match=message):
        pull(controller, state, PROJECT)
    assert tree(host) == before
    assert not (host.parent / "escape.txt").exists()
    assert state.snapshots(PROJECT) == []


def test_in_tree_symlink_is_accepted(env):
    host, sandbox, state, controller = env
    os.symlink("../README.md", sandbox / "src/readme-link")
    pull(controller, state, PROJECT)
    assert os.readlink(host / "src/readme-link") == "../README.md"


@pytest.mark.parametrize("path", ["../outside.txt", ".git/config", "a/./b", "/etc/passwd"])
def test_unsafe_change_paths_are_rejected(env, path):
    host, sandbox, state, controller = env
    controller.sync_changes = lambda _pid: {
        "projectId": PROJECT, "baselineAt": "x", "changes": [{"path": path, "kind": "added", "sha256": "0", "size": 1}], "totalBytes": 1,
    }
    with pytest.raises(SyncBackError):
        pull(controller, state, PROJECT)


def test_symlinked_parent_leaving_the_checkout_is_rejected(env, tmp_path):
    host, sandbox, state, controller = env
    outside = tmp_path / "outside"
    outside.mkdir()
    os.symlink(outside, host / "linked")
    write(sandbox, "linked/x.txt", "x")
    with pytest.raises(SyncBackError, match="leaves"):
        pull(controller, state, PROJECT)
    assert list(outside.iterdir()) == []


def test_repeated_revert_walks_back(env):
    host, sandbox, state, controller = env
    original = tree(host)
    write(sandbox, "src/app.py", "print('v2')\n")
    first = pull(controller, state, PROJECT)
    after_first = tree(host)
    write(sandbox, "src/app.py", "print('v3')\n")
    write(sandbox, "extra.txt", "e\n")
    second = pull(controller, state, PROJECT)
    assert first.snapshot_id != second.snapshot_id
    assert revert(state, PROJECT).snapshot_id == second.snapshot_id
    assert tree(host) == after_first
    assert revert(state, PROJECT).snapshot_id == first.snapshot_id
    assert tree(host) == original


def test_revert_conflict_when_host_edited_after_the_pull(env):
    host, sandbox, state, controller = env
    write(sandbox, "src/app.py", "print('v2')\n")
    pull(controller, state, PROJECT)
    write(host, "src/app.py", "print('edited after pull')\n")
    with pytest.raises(SyncConflict) as error:
        revert(state, PROJECT)
    assert error.value.conflicts == ["src/app.py"]
    assert (host / "src/app.py").read_text() == "print('edited after pull')\n"
    outcome = revert(state, PROJECT, force=True)
    assert (host / "src/app.py").read_text() == "print('v1')\n"
    assert outcome.displaced == ["src/app.py"]
    assert (Path(outcome.displaced_dir) / "src/app.py").read_text() == "print('edited after pull')\n"


def test_revert_puts_the_baseline_back_so_the_changes_are_offered_again(env):
    host, sandbox, state, controller = env
    before = tree(host)
    sandbox_edits(sandbox)
    pull(controller, state, PROJECT)
    assert controller.sync_changes(PROJECT)["changes"] == []
    outcome = revert(state, PROJECT)
    restore_baseline(controller, outcome)
    assert tree(host) == before and outcome.warnings == []
    offered = {c["path"]: c["kind"] for c in controller.sync_changes(PROJECT)["changes"]}
    assert offered == {"src/app.py": "modified", "src/new/feature.py": "added", "src/old.py": "deleted"}
    again = pull(controller, state, PROJECT)
    assert again.conflicts == [] and tree(host) == tree(sandbox)


def test_revert_of_a_forced_pull_still_protects_the_host_edit(env):
    host, sandbox, state, controller = env
    write(host, "src/app.py", "print('host edit')\n")
    sandbox_edits(sandbox)
    pull(controller, state, PROJECT, force=True)
    restore_baseline(controller, revert(state, PROJECT))
    assert (host / "src/app.py").read_text() == "print('host edit')\n"
    with pytest.raises(SyncConflict) as error:
        pull(controller, state, PROJECT)
    assert error.value.conflicts == ["src/app.py"]


def test_revert_without_the_sandbox_still_reverts_and_warns(env):
    host, sandbox, state, controller = env
    before = tree(host)
    sandbox_edits(sandbox)
    pull(controller, state, PROJECT)
    outcome = revert(state, PROJECT)
    restore_baseline(None, outcome)
    assert tree(host) == before and "not offer" in outcome.warnings[0]


def test_dry_run_writes_nothing(env):
    host, sandbox, state, controller = env
    sandbox_edits(sandbox)
    write(host, "src/app.py", "host edit\n")
    before = tree(host)
    outcome = pull(controller, state, PROJECT, dry_run=True)
    assert outcome.dry_run and outcome.total == 3 and outcome.conflicts == ["src/app.py"]
    assert tree(host) == before
    assert state.snapshots(PROJECT) == [] and controller.acks == []


def test_paths_filter_limits_the_pull(env):
    host, sandbox, state, controller = env
    sandbox_edits(sandbox)
    outcome = pull(controller, state, PROJECT, paths=["src/app.py"])
    assert outcome.total == 1 and (host / "src/old.py").exists()
    assert [c["path"] for c in controller.sync_changes(PROJECT)["changes"]] == ["src/new/feature.py", "src/old.py"]


def test_host_permissions_are_kept_but_the_executable_bit_follows_the_sandbox(env):
    host, sandbox, state, controller = env
    os.chmod(host / "src/app.py", 0o600)
    os.chmod(host / "README.md", 0o755)
    write(sandbox, "src/app.py", "print('v2')\n")
    os.chmod(sandbox / "src/app.py", 0o755)
    write(sandbox, "README.md", "hello v2\n")
    os.chmod(sandbox / "README.md", 0o644)
    write(sandbox, "run.sh", "#!/bin/sh\n")
    os.chmod(sandbox / "run.sh", 0o750)
    pull(controller, state, PROJECT)
    assert (host / "src/app.py").stat().st_mode & 0o777 == 0o700
    assert (host / "README.md").stat().st_mode & 0o777 == 0o644
    assert (host / "run.sh").stat().st_mode & 0o777 == 0o750
    acked = {change["path"]: change for change in controller.acks[0]}
    assert acked["src/app.py"]["executable"] is True
    assert acked["README.md"]["executable"] is False
    revert(state, PROJECT)
    assert (host / "src/app.py").stat().st_mode & 0o777 == 0o600
    assert (host / "README.md").stat().st_mode & 0o777 == 0o755


def test_only_the_newest_20_snapshots_are_kept(env):
    host, sandbox, state, controller = env
    for n in range(22):
        write(sandbox, "src/app.py", f"print({n})\n")
        pull(controller, state, PROJECT)
    snapshots = state.snapshots(PROJECT)
    assert len(snapshots) == 20
    assert len({s.id for s in snapshots}) == 20


def test_unlinked_project_fails(tmp_path):
    with pytest.raises(SyncBackError, match="monolith --sync"):
        pull(FakeController(tmp_path), SyncState(tmp_path / "state"), PROJECT)


def test_request_handling_applies_and_completes(env):
    host, sandbox, state, controller = env
    sandbox_edits(sandbox)
    request = controller.add_request("pull")
    assert claimable(request, state)
    handled = handle_request(controller, state, request, "laptop")
    assert handled.ok
    stored = controller.requests[request["id"]]
    assert stored["status"] == "applied" and stored["claimedBy"] == "laptop"
    assert stored["result"]["added"] == 1 and stored["result"]["modified"] == 1 and stored["result"]["deleted"] == 1
    assert stored["result"]["snapshotId"] == state.snapshots(PROJECT)[0].id

    revert_request = controller.add_request("revert")
    assert handle_request(controller, state, revert_request, "laptop").ok
    assert controller.requests[revert_request["id"]]["result"]["modified"] == 1
    assert (host / "src/old.py").exists()
    assert len(controller.sync_changes(PROJECT)["changes"]) == 3


def test_request_with_conflicts_fails_with_the_list(env):
    host, sandbox, state, controller = env
    write(host, "src/app.py", "host edit\n")
    sandbox_edits(sandbox)
    request = controller.add_request("pull")
    handled = handle_request(controller, state, request, "laptop")
    stored = controller.requests[request["id"]]
    assert not handled.ok and stored["status"] == "failed"
    assert stored["result"]["conflicts"] == ["src/app.py"] and "changed on the host" in stored["error"]
    forced = controller.add_request("pull", force=True)
    assert handle_request(controller, state, forced, "laptop").ok


def test_requests_for_unlinked_projects_are_not_claimable(env, tmp_path):
    _host, _sandbox, _state, controller = env
    assert not claimable(controller.add_request("pull"), SyncState(tmp_path / "empty"))


def test_already_claimed_request_raises_conflict(env):
    _host, _sandbox, state, controller = env
    request = controller.add_request("pull")
    controller.claim_sync_request(request["id"], "other")
    with pytest.raises(ApiError):
        handle_request(controller, state, request, "laptop")


def test_cli_pull_revert_and_status(env, capsys):
    host, sandbox, state, controller = env
    sandbox_edits(sandbox)
    ids = lambda name: name  # noqa: E731
    assert run_status(str(host), lambda: controller, ids, state) == EXIT_OK
    assert "M src/app.py" in capsys.readouterr().out

    write(host, "src/app.py", "host edit\n")
    assert run_pull(str(host), lambda: controller, ids, dry_run=True, state=state) == EXIT_CONFLICT
    captured = capsys.readouterr()
    assert "Would pull 3 files" in captured.out and "src/app.py" in captured.err
    assert run_pull(str(host), lambda: controller, ids, state=state) == EXIT_CONFLICT
    assert run_pull(str(host), lambda: controller, ids, force=True, state=state) == EXIT_OK
    out = capsys.readouterr().out
    assert f"Pulled 3 files into {host.resolve()} (1 added, 1 modified, 1 deleted) · snapshot" in out
    assert "undo with monolith --revert" in out
    write(host, "src/app.py", "edited after the pull\n")
    assert run_revert(str(host), ids, state=state, client_factory=lambda: controller) == EXIT_CONFLICT
    err = capsys.readouterr().err
    assert "Nothing was reverted" in err and "snapshot is still taken" not in err
    assert run_revert(str(host), ids, force=True, state=state, client_factory=lambda: controller) == EXIT_OK
    captured = capsys.readouterr()
    assert "Reverted snapshot" in captured.out and "copies are in" in captured.out and captured.err == ""
    assert len(controller.sync_changes(PROJECT)["changes"]) == 3
    assert run_revert(str(host), ids, state=state) == EXIT_ERROR
    assert run_pull(str(host.parent), lambda: controller, ids, state=state) == EXIT_ERROR
    assert "monolith --sync" in capsys.readouterr().err


def test_run_sync_records_the_link_and_host_manifest(tmp_path, monkeypatch):
    from monolith_desktop import sync

    root = tmp_path / "My App"
    write(root, "index.ts", "x")
    write(root, ".git/HEAD", "ref")

    class Pusher:
        def sync_project(self, project_id, archive, size, confidential=False):
            return {"path": f"/workspace/projects/{project_id}"}, True

    monkeypatch.setattr(sync, "connect", lambda: (Pusher(), "sandbox"))
    state = SyncState(tmp_path / "state")
    assert sync.run_sync(str(root), state) == 0
    link = state.link("my-app")
    assert link.host_path == str(root.resolve())
    assert link.manifest == {"index.ts": hash_path(root / "index.ts")}


def test_service_claims_linked_requests_once_and_notifies(env, monkeypatch):
    from monolith_desktop.services import syncback as service_module
    from monolith_desktop.store import AppStore

    host, sandbox, state, controller = env
    sandbox_edits(sandbox)

    def run_now(fn, *args, on_success=None, on_error=None, on_done=None, **kwargs):
        try:
            value = fn(*args, **kwargs)
        except Exception as error:  # noqa: BLE001
            if on_error:
                on_error(error)
        else:
            if on_success:
                on_success(value)
        if on_done:
            on_done()

    class Events:
        def __init__(self):
            self.listeners = {}

        def subscribe(self, kind, listener):
            self.listeners.setdefault(kind, []).append(listener)

    class App:
        def __init__(self):
            self.sent = []

        def send_notification(self, notification_id, notification):
            self.sent.append(notification_id)

    monkeypatch.setattr(service_module, "run_async", run_now)
    controller.pending_sync_requests = lambda: [r for r in controller.requests.values() if r["status"] == "pending"]
    controller.sync_heartbeat = lambda host_name, projects, changes=None: controller.heartbeats.append((host_name, projects, changes))
    events, app = Events(), App()
    service = service_module.SyncBackService(app, AppStore(), lambda: controller, events, state)
    request = controller.add_request("pull")
    events.listeners["sync.updated"][0]({"type": "sync.updated", "request": dict(request)})
    events.listeners["sync.updated"][0]({"type": "sync.updated", "request": dict(request)})
    assert controller.requests[request["id"]]["status"] == "applied"
    assert app.sent == [f"sync-{PROJECT}"]
    assert (host / "src/new/feature.py").exists()
    service._enqueue_all(service._beat())
    assert controller.heartbeats[-1][1] == [PROJECT]
    assert controller.heartbeats[-1][2] == {PROJECT: 0}
