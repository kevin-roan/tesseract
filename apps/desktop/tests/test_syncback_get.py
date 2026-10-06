import io
import json
import os
import tarfile
from pathlib import Path

import pytest

from monolith_desktop.api.errors import NetworkError
from monolith_desktop.syncback import SyncState
from monolith_desktop.syncback import get as get_module
from monolith_desktop.syncback.cli import EXIT_ERROR, EXIT_OK, run_get_on_host, run_status
from monolith_desktop.syncback.manifest import hash_path
from monolith_desktop.syncback.requests import handle_request
from monolith_desktop.syncback.state import Link
from monolith_desktop.syncback.summary import describe_result
from monolith_desktop.syncback.tree import collect_files, contained, git_manifest, scan_tree

PROJECT = "demo"
PUSHED_AT = "2026-09-30T20:00:00.000Z"
SYNCED_AT = "2026-10-01T12:00:00.000Z"


def write(root: Path, rel: str, text: str) -> None:
    (root / rel).parent.mkdir(parents=True, exist_ok=True)
    (root / rel).write_text(text)


class FakeController:
    """The §3 get endpoints: plan (optionally failing on conflicts) and apply, recording what was sent."""

    def __init__(self) -> None:
        self.requests: dict[str, dict] = {}
        self.plans: list[dict] = []
        self.archives: list[dict[str, tarfile.TarInfo]] = []
        self.contents: dict[str, bytes] = {}
        self.completed: list[tuple[str, str]] = []
        self.conflicts: list[str] = []
        self.upload: list[str] | None = None
        self.git_upload: list[str] | None = None
        self.apply_status = "applied"
        self.before_apply = None

    def add_request(self, kind: str = "get", force: bool = False) -> dict:
        request = {"id": f"sync_{len(self.requests) + 1}", "projectId": PROJECT, "kind": kind, "status": "pending",
                   "paths": None, "force": force, "source": "cli", "claimedBy": None, "result": None, "error": None}
        self.requests[request["id"]] = request
        return request

    def claim_sync_request(self, request_id: str, host: str) -> dict:
        self.requests[request_id].update(status="claimed", claimedBy=host)
        return dict(self.requests[request_id])

    def complete_sync_request(self, request_id: str, status: str, result=None, error=None) -> dict:
        request = self.requests[request_id]
        assert request["status"] == "claimed"
        self.completed.append((request_id, status))
        request.update(status=status, result=result, error=error)
        return dict(request)

    def sync_get_plan(self, request_id: str, plan: dict) -> dict:
        json.dumps(plan)
        self.plans.append(plan)
        request = self.requests[request_id]
        if self.conflicts:
            result = {"added": 0, "modified": 0, "deleted": 0, "conflicts": self.conflicts, "snapshotId": None, "hostPath": plan["hostPath"]}
            request.update(status="failed", result=result, error=f"{len(self.conflicts)} files changed in the sandbox")
            return {"request": dict(request), "upload": [], "gitUpload": []}
        upload = [c["path"] for c in plan["changes"] if c["kind"] != "deleted"] if self.upload is None else self.upload
        git_upload = (plan["git"]["changed"] if plan["git"] else []) if self.git_upload is None else self.git_upload
        if self.before_apply:
            self.before_apply()
        return {"request": dict(request), "upload": upload, "gitUpload": git_upload}

    def sync_get_apply(self, request_id: str, archive, size: int) -> dict:
        data = archive.read()
        assert len(data) == size
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
            members = {member.name: member for member in tar}
            self.contents = {name: tar.extractfile(m).read() for name, m in members.items() if m.isreg()}
        self.archives.append(members)
        request = self.requests[request_id]
        counts = {kind: sum(c["kind"] == kind for c in self.plans[-1]["changes"]) for kind in ("added", "modified", "deleted")}
        if self.apply_status == "failed":
            request.update(status="failed", error="1 file changed in the sandbox", result={**counts, "conflicts": ["README.md"]})
        else:
            request.update(status="applied", result={
                **counts, "conflicts": [], "snapshotId": None, "hostPath": self.plans[-1]["hostPath"],
                "insertions": 3, "deletions": 1, "gitFiles": len(self.plans[-1]["git"]["changed"]) if self.plans[-1]["git"] else 0,
                "syncedAt": SYNCED_AT, "previousSyncAt": PUSHED_AT, "backupPath": None,
            })
        return dict(request)


def push(state: SyncState, host: Path) -> Link:
    tree = scan_tree(host, collect_files(host))
    link = Link(PROJECT, str(host.resolve()), PUSHED_AT, tree.manifest, tree.executable, tree.git)
    state.save_link(link)
    return link


@pytest.fixture
def env(tmp_path):
    host = tmp_path / "host" / PROJECT
    write(host, "README.md", "hello\n")
    write(host, "src/app.py", "print('v1')\n")
    write(host, "src/old.py", "old\n")
    write(host, "run.sh", "echo run\n")
    write(host, ".git/HEAD", "ref: refs/heads/main\n")
    write(host, ".git/refs/heads/main", "a" * 40 + "\n")
    write(host, ".git/objects/aa/one", "object one")
    state = SyncState(tmp_path / "state")
    push(state, host)
    return host, state, FakeController()


def host_edits(host: Path) -> None:
    write(host, "src/app.py", "print('v2')\n")
    write(host, "src/new/feature.py", "new\n")
    (host / "src/old.py").unlink()


def run_get(controller: FakeController, state: SyncState, force: bool = False):
    return handle_request(controller, state, controller.add_request("get", force), "laptop")


def test_get_sends_added_modified_and_deleted_and_records_the_link(env):
    host, state, controller = env
    host_edits(host)
    handled = run_get(controller, state)
    assert handled.ok, handled.message
    assert controller.plans[0]["hostPath"] == str(host.resolve())
    assert controller.plans[0]["changes"] == [
        {"path": "src/app.py", "kind": "modified", "sha256": hash_path(host / "src/app.py"), "executable": False},
        {"path": "src/new/feature.py", "kind": "added", "sha256": hash_path(host / "src/new/feature.py"), "executable": False},
        {"path": "src/old.py", "kind": "deleted", "sha256": None, "executable": False},
    ]
    assert controller.plans[0]["git"] == {"changed": [], "deleted": []}
    assert set(controller.archives[0]) == {"src/app.py", "src/new/feature.py"}
    assert controller.contents["src/app.py"] == b"print('v2')\n"
    assert controller.completed == []
    assert handled.message == "Sent 3 files to the sandbox (1 added, 1 modified, 1 deleted) · +3 −1"
    link = state.link(PROJECT)
    assert link.pushed_at == PUSHED_AT and link.got_at == SYNCED_AT
    assert link.manifest == scan_tree(host, collect_files(host)).manifest
    assert "src/old.py" not in link.manifest

    again = run_get(controller, state)
    assert again.ok and controller.plans[1]["changes"] == [] and set(controller.archives[1]) == set()
    assert again.message == "Sandbox already up to date"


def test_a_get_requested_from_the_desktop_is_applied_the_same_way(env):
    host, state, controller = env
    host_edits(host)
    request = {**controller.add_request("get"), "source": "desktop"}
    controller.requests[request["id"]] = request
    handled = handle_request(controller, state, request, "laptop")
    assert handled.ok and handled.request["source"] == "desktop"
    assert handled.message == "Sent 3 files to the sandbox (1 added, 1 modified, 1 deleted) · +3 −1"


def test_executable_bit_change_is_a_modification_when_the_link_knows_the_bits(env):
    host, state, controller = env
    os.chmod(host / "run.sh", 0o755)
    run_get(controller, state)
    assert controller.plans[0]["changes"] == [
        {"path": "run.sh", "kind": "modified", "sha256": hash_path(host / "run.sh"), "executable": True}
    ]
    assert state.link(PROJECT).executable == ["run.sh"]
    os.chmod(host / "run.sh", 0o644)
    run_get(controller, state)
    assert controller.plans[1]["changes"][0]["executable"] is False
    assert state.link(PROJECT).executable == []


def test_executable_bit_change_is_ignored_when_the_link_predates_it(env):
    host, state, controller = env
    link = state.link(PROJECT)
    link.executable = None
    state.save_link(link)
    os.chmod(host / "run.sh", 0o755)
    write(host, "added.sh", "x")
    os.chmod(host / "added.sh", 0o755)
    run_get(controller, state)
    assert [(c["path"], c["executable"]) for c in controller.plans[0]["changes"]] == [("added.sh", True)]
    assert state.link(PROJECT).executable == ["added.sh", "run.sh"]


def test_git_changes_are_diffed_by_size_and_mtime_skipping_locks(env):
    host, state, controller = env
    write(host, ".git/refs/heads/main", "b" * 40 + "\n")
    os.utime(host / ".git/refs/heads/main", ns=(1, 1))
    write(host, ".git/objects/bb/two", "object two")
    write(host, ".git/index.lock", "busy")
    (host / ".git/objects/aa/one").unlink()
    run_get(controller, state)
    assert controller.plans[0]["git"] == {"changed": ["objects/bb/two", "refs/heads/main"], "deleted": ["objects/aa/one"]}
    assert set(controller.archives[0]) == {".git/objects/bb/two", ".git/refs/heads/main"}
    assert controller.contents[".git/refs/heads/main"] == b"b" * 40 + b"\n"
    assert state.link(PROJECT).git_manifest == git_manifest(host)
    assert "index.lock" not in state.link(PROJECT).git_manifest


def test_link_without_a_git_manifest_sends_the_whole_git_dir(env):
    host, state, controller = env
    link = state.link(PROJECT)
    link.git_manifest = None
    state.save_link(link)
    run_get(controller, state)
    assert controller.plans[0]["git"] == {"changed": ["HEAD", "objects/aa/one", "refs/heads/main"], "deleted": []}


def test_git_file_or_symlink_is_not_a_git_dir(tmp_path):
    (tmp_path / "worktree").mkdir()
    (tmp_path / "worktree/.git").write_text("gitdir: /elsewhere\n")
    assert git_manifest(tmp_path / "worktree") is None
    (tmp_path / "real/.git").mkdir(parents=True)
    (tmp_path / "linked").mkdir()
    os.symlink(tmp_path / "real/.git", tmp_path / "linked/.git")
    assert git_manifest(tmp_path / "linked") is None
    assert get_module.plan_git(None, {"HEAD": "1:1"}) is None


def test_git_walk_does_not_follow_symlinks(env, tmp_path):
    host, _state, _controller = env
    outside = tmp_path / "outside"
    write(outside, "secret", "x")
    os.symlink(outside, host / ".git/escape")
    os.symlink(outside / "secret", host / ".git/secret-link")
    assert not any(path.startswith(("escape", "secret")) for path in git_manifest(host))


def test_paths_whose_parent_leaves_the_checkout_are_skipped(env, tmp_path, monkeypatch):
    host, state, controller = env
    outside = tmp_path / "outside"
    write(outside, "secret.txt", "secret")
    os.symlink(outside, host / "escape")
    os.symlink("README.md", host / "entry.md")
    assert contained(host, ["escape/secret.txt", "README.md", "../x", ".git/config", "src/app.py"]) == ["README.md", "src/app.py"]
    monkeypatch.setattr(get_module, "collect_files", lambda root: iter(["escape/secret.txt", "README.md", "entry.md", "run.sh"]))
    run_get(controller, state)
    paths = {c["path"]: c["kind"] for c in controller.plans[0]["changes"]}
    assert "escape/secret.txt" not in paths and paths["entry.md"] == "added"
    assert controller.archives[0]["entry.md"].issym() and controller.archives[0]["entry.md"].linkname == "README.md"


def test_conflicts_at_plan_are_reported_without_completing_again(env):
    host, state, controller = env
    before = state.link(PROJECT)
    host_edits(host)
    controller.conflicts = ["src/app.py"]
    handled = run_get(controller, state)
    assert not handled.ok and handled.message == "1 files changed in the sandbox"
    assert handled.result["conflicts"] == ["src/app.py"]
    assert controller.completed == [] and controller.archives == []
    assert state.link(PROJECT) == before


def test_failed_apply_is_reported_without_completing_again(env):
    host, state, controller = env
    before = state.link(PROJECT)
    host_edits(host)
    controller.apply_status = "failed"
    handled = run_get(controller, state)
    assert not handled.ok and "changed in the sandbox" in handled.message
    assert controller.completed == [] and state.link(PROJECT) == before


@pytest.mark.parametrize("field, value", [("upload", ["README.md"]), ("upload", ["src/old.py"]), ("git_upload", ["config"])])
def test_unplanned_uploads_are_refused(env, field, value):
    host, state, controller = env
    before = state.link(PROJECT)
    host_edits(host)
    setattr(controller, field, value)
    handled = run_get(controller, state)
    request = controller.requests[handled.request["id"]]
    assert not handled.ok and request["status"] == "failed" and "unplanned" in request["error"]
    assert controller.archives == [] and state.link(PROJECT) == before


def test_file_that_vanished_before_the_upload_fails_the_request(env):
    host, state, controller = env
    host_edits(host)
    controller.before_apply = lambda: (host / "src/new/feature.py").unlink()
    handled = run_get(controller, state)
    assert not handled.ok and "src/new/feature.py changed during the sync, run monolith --get again" in handled.message
    assert controller.completed == [(handled.request["id"], "failed")]


def test_too_many_changes_fail_with_the_sync_advice(env, monkeypatch):
    host, state, controller = env
    host_edits(host)
    monkeypatch.setattr(get_module, "MAX_CHANGES", 2)
    handled = run_get(controller, state)
    assert not handled.ok and "monolith --sync" in handled.message and controller.plans == []
    monkeypatch.setattr(get_module, "MAX_CHANGES", 5000)
    monkeypatch.setattr(get_module, "MAX_GIT_PATHS", 0)
    write(host, ".git/objects/cc/three", "x")
    handled = run_get(controller, state)
    assert not handled.ok and ".git files" in handled.message and controller.plans == []


def test_errors_complete_the_request_failed(env, monkeypatch):
    host, state, controller = env

    def offline(request_id, plan):
        raise NetworkError("connection refused")

    monkeypatch.setattr(controller, "sync_get_plan", offline)
    handled = run_get(controller, state)
    assert not handled.ok and handled.request["status"] == "failed" and "connection refused" in handled.request["error"]
    for path in sorted(host.rglob("*"), reverse=True):
        path.unlink() if not path.is_dir() or path.is_symlink() else path.rmdir()
    host.rmdir()
    handled = run_get(controller, state)
    assert handled.request["status"] == "failed" and "no longer exists" in handled.request["error"]


def test_pull_and_revert_keep_the_executable_list_in_step(tmp_path):
    state = SyncState(tmp_path / "state")
    state.save_link(Link(PROJECT, str(tmp_path), PUSHED_AT, {"a.sh": "1", "b": "2"}, ["b"]))
    state.update_manifest(PROJECT, {"a.sh": "3", "b": None}, {"a.sh": True})
    assert state.link(PROJECT).executable == ["a.sh"] and state.link(PROJECT).manifest == {"a.sh": "3"}
    state.save_link(Link(PROJECT, str(tmp_path), PUSHED_AT, {"a.sh": "1"}))
    state.update_manifest(PROJECT, {"a.sh": "3"}, {"a.sh": True})
    assert state.link(PROJECT).executable is None


def test_old_links_without_the_get_fields_still_load(tmp_path):
    state = SyncState(tmp_path / "state")
    state.root.mkdir(parents=True)
    state.links_path.write_text(json.dumps({PROJECT: {"hostPath": "/src/demo", "pushedAt": PUSHED_AT, "manifest": {"a": "1"}}}))
    link = state.link(PROJECT)
    assert (link.executable, link.git_manifest, link.got_at) == (None, None, None)
    assert link.to_json() == {"hostPath": "/src/demo", "pushedAt": PUSHED_AT, "manifest": {"a": "1"}}
    state.record_get(PROJECT, {"b": "2"}, ["b"], {"HEAD": "1:2"}, SYNCED_AT)
    stored = json.loads(state.links_path.read_text())[PROJECT]
    assert stored == {"hostPath": "/src/demo", "pushedAt": PUSHED_AT, "manifest": {"b": "2"}, "executable": ["b"],
                      "gitManifest": {"HEAD": "1:2"}, "gotAt": SYNCED_AT}
    state.record_get("unknown", {}, [], None, SYNCED_AT)
    assert "unknown" not in state.links()


def test_run_sync_records_executable_bits_and_the_git_manifest(tmp_path, monkeypatch):
    from monolith_desktop import sync

    root = tmp_path / "My App"
    write(root, "index.ts", "x")
    write(root, "bin/run", "#!/bin/sh\n")
    os.chmod(root / "bin/run", 0o755)
    write(root, ".git/HEAD", "ref")
    write(root, ".git/index.lock", "busy")

    class Pusher:
        def sync_project(self, project_id, archive, size, confidential=False):
            return {"path": f"/workspace/projects/{project_id}"}, True

    monkeypatch.setattr(sync, "connect", lambda: (Pusher(), "sandbox"))
    state = SyncState(tmp_path / "state")
    assert sync.run_sync(str(root), state) == 0
    link = state.link("my-app")
    assert link.executable == ["bin/run"]
    assert list(link.git_manifest) == ["HEAD"]
    info = os.stat(root / ".git/HEAD")
    assert link.git_manifest["HEAD"] == f"{info.st_size}:{info.st_mtime_ns}"
    assert link.got_at is None


def test_describe_get_results():
    assert describe_result("get", {"added": 0, "modified": 0, "deleted": 0}) == "Sandbox already up to date"
    assert describe_result("get", {"added": 0, "modified": 0, "deleted": 0, "gitFiles": 3}) == (
        "Sandbox already up to date · updated .git (3 files)"
    )
    assert describe_result("get", {"added": 1, "modified": 2, "deleted": 0, "insertions": 12, "deletions": 4,
                                    "backupPath": "/data/sync/backups/demo/sync_1"}) == (
        "Sent 3 files to the sandbox (1 added, 2 modified) · +12 −4 · sandbox edits kept in /data/sync/backups/demo/sync_1"
    )


def test_status_shows_the_last_get_and_host_get_explains_itself(env, capsys):
    host, state, controller = env
    controller.sync_changes = lambda project_id: {"projectId": project_id, "baselineAt": PUSHED_AT, "changes": [], "totalBytes": 0, "host": None}
    assert run_status(str(host), lambda: controller, lambda name: name, state) == EXIT_OK
    assert f"pushed {PUSHED_AT} · got never" in capsys.readouterr().out
    run_get(controller, state)
    run_status(str(host), lambda: controller, lambda name: name, state)
    assert f"pushed {PUSHED_AT} · got {SYNCED_AT}" in capsys.readouterr().out
    assert run_get_on_host() == EXIT_ERROR
    assert "runs inside the sandbox" in capsys.readouterr().err


def test_notifications_and_labels_know_get():
    from monolith_desktop.pages.projects.labels import SYNC_KINDS
    from monolith_desktop.services.syncback import notification_kind
    from monolith_desktop.strings import SYNC_BACK

    assert SYNC_KINDS["get"] == "Sync from host"
    assert notification_kind({"kind": "get"}) == "get" and notification_kind({"kind": "other"}) == "pull"
    assert SYNC_BACK["get_done"].format(project="demo") == "Sent demo changes to the sandbox"


def test_host_changes_lists_what_a_get_would_bring_in(tmp_path):
    from monolith_desktop.syncback.manifest import DigestCache, build_manifest

    host = tmp_path / "host"
    write(host, "same.txt", "a")
    write(host, "edited.txt", "a")
    write(host, "gone.txt", "a")
    link = Link(PROJECT, str(host), PUSHED_AT, build_manifest(host, ["same.txt", "edited.txt", "gone.txt"]))
    digests = DigestCache()
    assert get_module.host_changes(link, digests) == []
    write(host, "edited.txt", "b")
    write(host, "new.txt", "a")
    (host / "gone.txt").unlink()
    assert get_module.host_changes(link, digests) == ["edited.txt", "gone.txt", "new.txt"]


def test_host_changes_is_empty_when_the_host_folder_is_missing(tmp_path):
    link = Link(PROJECT, str(tmp_path / "missing"), PUSHED_AT, {"a.txt": "0" * 64})
    assert get_module.host_changes(link) == []


def test_digest_cache_rehashes_only_files_whose_stat_changed(tmp_path, monkeypatch):
    from monolith_desktop.syncback import manifest

    write(tmp_path, "a.txt", "one")
    hashed = []
    real = manifest.hash_path
    monkeypatch.setattr(manifest, "hash_path", lambda path: hashed.append(path) or real(path))
    digests = manifest.DigestCache()
    first = digests(tmp_path / "a.txt")
    assert digests(tmp_path / "a.txt") == first and len(hashed) == 1
    write(tmp_path, "a.txt", "two!")
    assert digests(tmp_path / "a.txt") != first and len(hashed) == 2
    (tmp_path / "a.txt").unlink()
    assert digests(tmp_path / "a.txt") is None
