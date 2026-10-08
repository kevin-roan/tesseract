"""Sync back end to end: a real controller (`bun apps/controller/src/index.ts serve`) and the real `tesseract` CLI.

Skipped when bun, git, tar, the repo's node_modules or PyGObject are missing. Everything lives in temp dirs:
the controller workspace, XDG_STATE_HOME/XDG_CONFIG_HOME/HOME of the CLI, and the host checkouts.
"""

import hashlib
import json
import os
import shutil
import socket
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
DESKTOP = REPO / "apps" / "desktop"
CONTROLLER = REPO / "apps" / "controller"
TOKEN = "e2e-sync-back-token"

pytestmark = pytest.mark.skipif(
    not all(shutil.which(tool) for tool in ("bun", "git", "tar")) or not (REPO / "node_modules").is_dir(),
    reason="needs bun, git, tar and the repo's node_modules to start a real controller",
)
pytest.importorskip("gi")

from tesseract_desktop.api.client import ControllerClient  # noqa: E402
from tesseract_desktop.api.errors import ApiError  # noqa: E402
from tesseract_desktop.syncback.requests import claimable, handle_request  # noqa: E402
from tesseract_desktop.syncback.state import SyncState  # noqa: E402


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


class Env:
    def __init__(self, root: Path, port: int) -> None:
        self.root = root
        self.url = f"http://127.0.0.1:{port}"
        self.projects = root / "ws" / "projects"
        self.state = SyncState(root / "state" / "tesseract")
        self.client = ControllerClient(self.url, TOKEN)
        self.cli_env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": str(root / "home"),
            "XDG_STATE_HOME": str(root / "state"),
            "XDG_CONFIG_HOME": str(root / "config"),
            "TESSERACT_DESKTOP_URL": self.url,
            "TESSERACT_TOKEN": TOKEN,
            "PYTHONPATH": str(DESKTOP),
            "LANG": "C.UTF-8",
        }

    def cli(self, cwd: Path, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, "-m", "tesseract_desktop", *args], cwd=cwd, env=self.cli_env, capture_output=True, text=True, timeout=60
        )

    def http(self, method: str, path: str, body: object | None = None) -> tuple[int, object]:
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(
            f"{self.url}{path}", data=data, method=method,
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                raw = response.read()
                return response.status, json.loads(raw) if response.headers.get_content_type() == "application/json" else raw
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read() or b"null")

    def sandbox(self, name: str) -> Path:
        return self.projects / name


@pytest.fixture(scope="module")
def e2e(tmp_path_factory):
    root = tmp_path_factory.mktemp("syncback-e2e")
    for sub in ("ws", "state", "config", "home", "hosts"):
        (root / sub).mkdir()
    port = free_port()
    env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": str(root / "home"),
        "TESSERACT_WORKSPACE": str(root / "ws"),
        "TESSERACT_HOST": "127.0.0.1",
        "TESSERACT_PORT": str(port),
        "TESSERACT_TOKEN": TOKEN,
        "TESSERACT_VNC_PORT": "1",
        "TESSERACT_DISPLAY": ":987",
        "TESSERACT_CLAUDE_BIN": "/nonexistent/claude",
        "TESSERACT_PUSH_URL": "off",
        "TESSERACT_STT_ENGINE": "none",
        "TESSERACT_TAILSCALE_SOCKET": str(root / "no-tailscale.sock"),
        "CLAUDE_CONFIG_DIR": str(root / "home" / ".claude"),
    }
    log = open(root / "controller.log", "wb")
    proc = subprocess.Popen(["bun", "src/index.ts", "serve"], cwd=CONTROLLER, env=env, stdout=log, stderr=subprocess.STDOUT)
    try:
        deadline = time.monotonic() + 20
        while True:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/v1/health", timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                pass
            if proc.poll() is not None or time.monotonic() > deadline:
                pytest.fail(f"controller did not start:\n{(root / 'controller.log').read_text(errors='replace')[-2000:]}")
            time.sleep(0.1)
        yield Env(root, port)
    finally:
        proc.terminate()
        try:
            proc.wait(10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        log.close()


def git(cwd: Path, *args: str) -> None:
    subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", *args],
        cwd=cwd, check=True, capture_output=True,
    )


def write(root: Path, rel: str, text: str) -> None:
    (root / rel).parent.mkdir(parents=True, exist_ok=True)
    (root / rel).write_text(text)


def make_repo(e2e: Env, name: str) -> Path:
    host = e2e.root / "hosts" / name
    write(host, ".gitignore", "node_modules/\n")
    write(host, "README.md", "# demo\n")
    write(host, "src/index.js", "console.log(1)\n")
    write(host, "src/remove-me.txt", "old\n")
    write(host, "run.sh", "echo run\n")
    write(host, "node_modules/dep/index.js", "module.exports = 1\n")
    os.symlink("src/index.js", host / "entry.js")
    git(host, "init", "-q")
    git(host, "add", "-A")
    git(host, "commit", "-q", "-m", "init")
    result = e2e.cli(host, "--sync")
    assert result.returncode == 0, result.stderr
    assert "linked for sync back" in result.stdout
    return host


def tree(root: Path) -> dict[str, tuple]:
    """path -> (kind, content or link target, executable) for everything but .git and node_modules."""
    found = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules") or Path(dirpath) != root]
        for name in filenames + [d for d in dirnames if (Path(dirpath) / d).is_symlink()]:
            path = Path(dirpath) / name
            rel = path.relative_to(root).as_posix()
            info = os.lstat(path)
            if stat.S_ISLNK(info.st_mode):
                found[rel] = ("link", os.readlink(path), False)
            else:
                found[rel] = ("file", path.read_bytes(), bool(info.st_mode & 0o111))
    return found


def modes(root: Path) -> dict[str, int]:
    return {rel: stat.S_IMODE(os.lstat(root / rel).st_mode) for rel, entry in tree(root).items() if entry[0] == "file"}


def digest_dir(root: Path) -> str:
    hasher = hashlib.sha256()
    for dirpath, dirnames, filenames in sorted(os.walk(root)):
        dirnames.sort()
        for name in sorted(filenames):
            path = Path(dirpath) / name
            hasher.update(str(path.relative_to(root)).encode() + b"\0" + path.read_bytes())
    return hasher.hexdigest()


def sandbox_edits(sandbox: Path) -> None:
    write(sandbox, "README.md", "# demo v2\n")
    write(sandbox, "lib/new/util.js", "export const x = 1\n")
    (sandbox / "src/remove-me.txt").unlink()
    os.chmod(sandbox / "run.sh", 0o755)
    (sandbox / "entry.js").unlink()
    os.symlink("README.md", sandbox / "entry.js")


def test_pull_dry_run_ack_and_revert(e2e):
    host = make_repo(e2e, "roundtrip")
    sandbox = e2e.sandbox("roundtrip")
    assert tree(sandbox) == tree(host)
    before, before_modes = tree(host), modes(host)
    git_before, deps_before = digest_dir(host / ".git"), digest_dir(host / "node_modules")
    sandbox_edits(sandbox)

    status = e2e.cli(host, "--sync-status")
    assert status.returncode == 0, status.stderr
    for line in ("M README.md", "A lib/new/util.js", "D src/remove-me.txt", "M run.sh", "M entry.js"):
        assert line in status.stdout
    assert "No snapshots yet" in status.stdout

    dry = e2e.cli(host, "--pull", "--dry-run")
    assert dry.returncode == 0, dry.stderr
    assert "Would pull 5 files" in dry.stdout
    assert tree(host) == before and e2e.state.snapshots("roundtrip") == []

    pulled = e2e.cli(host, "--pull")
    assert pulled.returncode == 0, pulled.stderr
    assert "Pulled 5 files" in pulled.stdout and "(1 added, 3 modified, 1 deleted)" in pulled.stdout
    assert tree(host) == tree(sandbox)
    assert modes(host)["run.sh"] == 0o755 and modes(host)["README.md"] == before_modes["README.md"]
    assert digest_dir(host / ".git") == git_before and digest_dir(host / "node_modules") == deps_before
    assert len(e2e.state.snapshots("roundtrip")) == 1

    again = e2e.cli(host, "--pull")
    assert again.returncode == 0 and "Nothing to sync" in again.stdout

    reverted = e2e.cli(host, "--revert")
    assert reverted.returncode == 0, reverted.stderr
    assert reverted.stderr == ""
    assert tree(host) == before and modes(host) == before_modes
    assert not (host / "lib").exists()
    assert digest_dir(host / ".git") == git_before

    # The revert put the sandbox baseline back: the same changes are offered again and pull without conflicts.
    status = e2e.cli(host, "--sync-status")
    assert "Sandbox changes (5)" in status.stdout and "changed on host" not in status.stdout
    nothing = e2e.cli(host, "--revert")
    assert nothing.returncode == 1 and "no sync to revert" in nothing.stderr
    repull = e2e.cli(host, "--pull")
    assert repull.returncode == 0, repull.stderr
    assert tree(host) == tree(sandbox)


def test_pull_conflict_force_and_revert_conflict(e2e):
    host = make_repo(e2e, "conflicts")
    sandbox = e2e.sandbox("conflicts")
    write(sandbox, "src/index.js", "console.log('sandbox')\n")
    write(sandbox, "NEW.md", "sandbox new\n")
    write(host, "src/index.js", "console.log('host edit')\n")
    before = tree(host)

    refused = e2e.cli(host, "--pull")
    assert refused.returncode == 2
    assert "src/index.js" in refused.stderr and "Nothing was written" in refused.stderr
    assert tree(host) == before and e2e.state.snapshots("conflicts") == []

    forced = e2e.cli(host, "--pull", "--force")
    assert forced.returncode == 0, forced.stderr
    assert (host / "src/index.js").read_text() == "console.log('sandbox')\n"
    assert e2e.cli(host, "--revert").returncode == 0
    assert tree(host) == before
    # Still protected after the revert: the host edit predates the forced pull.
    assert e2e.cli(host, "--pull").returncode == 2

    write(sandbox, "DOCS.md", "## docs\n")
    assert e2e.cli(host, "--pull", "--force").returncode == 0
    write(host, "DOCS.md", "## docs\nhost tweak\n")
    blocked = e2e.cli(host, "--revert")
    assert blocked.returncode == 2 and "DOCS.md" in blocked.stderr and "Nothing was reverted" in blocked.stderr
    assert (host / "DOCS.md").read_text() == "## docs\nhost tweak\n"
    done = e2e.cli(host, "--revert", "--force")
    assert done.returncode == 0, done.stderr
    assert tree(host) == before
    displaced = e2e.state.snapshots("conflicts")[0].displaced_copy("DOCS.md")
    assert displaced.read_text() == "## docs\nhost tweak\n"


def test_export_refuses_unsafe_paths(e2e):
    make_repo(e2e, "safety")
    write(e2e.sandbox("safety"), "README.md", "changed\n")
    for path in ("../x", ".git/config", "/etc/passwd", "node_modules/dep/index.js", "src/index.js"):
        status, _ = e2e.http("POST", "/v1/projects/safety/sync/export", {"paths": [path]})
        assert status == 400, path
    status, body = e2e.http("POST", "/v1/projects/safety/sync/export", {"paths": ["README.md"]})
    assert status == 200 and body[:2] == b"\x1f\x8b"
    status, _ = e2e.http("POST", "/v1/projects/safety/sync/ack", {"changes": [{"path": ".git/config", "sha256": None}]})
    assert status == 400


def drive(e2e: Env) -> list:
    """One pass of the desktop companion's request loop (heartbeat, poll, claim, apply, complete)."""
    e2e.client.sync_heartbeat("e2e-host", list(e2e.state.links()))
    return [handle_request(e2e.client, e2e.state, r, "e2e-host") for r in e2e.client.pending_sync_requests() if claimable(r, e2e.state)]


def test_mobile_requests_are_applied_by_the_desktop_handler(e2e):
    host = make_repo(e2e, "requests")
    sandbox = e2e.sandbox("requests")
    before = tree(host)
    sandbox_edits(sandbox)

    status, created = e2e.http("POST", "/v1/projects/requests/sync/requests", {"kind": "pull", "source": "mobile"})
    assert status == 201 and created["status"] == "pending"
    status, _ = e2e.http("POST", "/v1/projects/requests/sync/requests", {"kind": "revert", "source": "mobile"})
    assert status == 409

    [handled] = drive(e2e)
    assert handled.ok, handled.message
    request = handled.request
    assert request["status"] == "applied" and request["claimedBy"] == "e2e-host" and request["source"] == "mobile"
    assert request["result"] == {
        "added": 1, "modified": 3, "deleted": 1, "conflicts": [],
        "snapshotId": e2e.state.snapshots("requests")[0].id, "hostPath": str(host.resolve()),
    }
    assert tree(host) == tree(sandbox)
    _, changes = e2e.http("GET", "/v1/projects/requests/sync/changes")
    assert changes["changes"] == [] and changes["host"]["name"] == "e2e-host" and changes["host"]["linked"]
    with pytest.raises(ApiError) as error:
        e2e.client.claim_sync_request(request["id"], "e2e-host")
    assert error.value.status == 409

    status, _ = e2e.http("POST", "/v1/projects/requests/sync/requests", {"kind": "revert", "source": "mobile"})
    assert status == 201
    [handled] = drive(e2e)
    assert handled.ok, handled.message
    assert handled.request["status"] == "applied"
    assert handled.request["result"]["added"] == 1 and handled.request["result"]["deleted"] == 1
    assert tree(host) == before
    _, changes = e2e.http("GET", "/v1/projects/requests/sync/changes")
    assert len(changes["changes"]) == 5

    e2e.http("POST", "/v1/projects/requests/sync/requests", {"kind": "revert", "source": "mobile"})
    [handled] = drive(e2e)
    assert not handled.ok and handled.request["status"] == "failed" and "no sync to revert" in handled.request["error"]


def head(root: Path) -> str:
    return subprocess.run(["git", "rev-parse", "HEAD"], cwd=root, check=True, capture_output=True, text=True).stdout.strip()


def request_get(e2e: Env, project: str, force: bool = False) -> None:
    status, created = e2e.http("POST", f"/v1/projects/{project}/sync/requests", {"kind": "get", "force": force, "source": "cli"})
    assert status == 201, created
    assert created["kind"] == "get" and created["status"] == "pending"


def test_get_brings_host_commits_into_the_sandbox(e2e):
    host = make_repo(e2e, "getting")
    sandbox = e2e.sandbox("getting")
    write(host, "README.md", "# demo\nmore\n")
    write(host, "src/index.js", "console.log(2)\n")
    write(host, "lib/added.js", "a\nb\n")
    (host / "src/remove-me.txt").unlink()
    os.chmod(host / "run.sh", 0o755)
    git(host, "add", "-A")
    git(host, "commit", "-q", "-m", "second")

    request_get(e2e, "getting")
    [handled] = drive(e2e)
    assert handled.ok, handled.message
    request = handled.request
    assert request["status"] == "applied" and request["claimedBy"] == "e2e-host"
    result = request["result"]
    assert (result["added"], result["modified"], result["deleted"], result["conflicts"]) == (1, 3, 1, [])
    assert (result["insertions"], result["deletions"]) == (4, 2)
    assert result["gitFiles"] > 0 and result["snapshotId"] is None
    files = {stat_["path"]: stat_ for stat_ in result["files"]}
    assert set(files) == {"README.md", "src/index.js", "lib/added.js", "src/remove-me.txt", "run.sh"}
    assert (files["run.sh"]["oldMode"], files["run.sh"]["newMode"]) == ("100644", "100755")
    assert (files["lib/added.js"]["kind"], files["lib/added.js"]["insertions"]) == ("added", 2)
    assert files["src/remove-me.txt"]["kind"] == "deleted" and files["src/remove-me.txt"]["newMode"] is None
    assert tree(sandbox) == tree(host)
    assert head(sandbox) == head(host)
    link = e2e.state.link("getting")
    assert link.got_at == result["syncedAt"] and link.pushed_at
    _, changes = e2e.http("GET", "/v1/projects/getting/sync/changes")
    assert changes["changes"] == [] and changes["lastGetAt"] == result["syncedAt"]

    request_get(e2e, "getting")
    [handled] = drive(e2e)
    assert handled.ok, handled.message
    assert handled.message.startswith("Sandbox already up to date")
    assert handled.request["result"]["added"] + handled.request["result"]["modified"] + handled.request["result"]["deleted"] == 0


def test_get_conflict_writes_nothing_until_forced(e2e):
    host = make_repo(e2e, "getconflict")
    sandbox = e2e.sandbox("getconflict")
    write(sandbox, "README.md", "sandbox edit\n")
    write(host, "README.md", "host edit\n")
    write(host, "NEW.md", "new\n")

    request_get(e2e, "getconflict")
    [handled] = drive(e2e)
    assert not handled.ok
    assert handled.request["status"] == "failed" and handled.request["result"]["conflicts"] == ["README.md"]
    assert (sandbox / "README.md").read_text() == "sandbox edit\n" and not (sandbox / "NEW.md").exists()
    assert e2e.state.link("getconflict").got_at is None

    request_get(e2e, "getconflict", force=True)
    [handled] = drive(e2e)
    assert handled.ok, handled.message
    result = handled.request["result"]
    assert (sandbox / "README.md").read_text() == "host edit\n" and (sandbox / "NEW.md").read_text() == "new\n"
    assert result["backupPath"]
    assert (Path(result["backupPath"]) / "README.md").read_text() == "sandbox edit\n"
    assert e2e.state.link("getconflict").got_at == result["syncedAt"]
