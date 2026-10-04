import pytest

from monolith_desktop.api.errors import ApiError
from monolith_desktop.pages.projects import model
from monolith_desktop.util.format import parse_iso

NOW = parse_iso("2026-09-28T12:00:00Z")


def project(id: str, commit_date: str | None = None, **extra) -> dict:
    git = None
    if commit_date is not None:
        git = {"branch": "main", "dirty": False, "ahead": 0, "behind": 0,
               "lastCommit": {"sha": "a" * 40, "subject": f"work on {id}", "date": commit_date}}
    base = {"id": id, "name": id, "path": f"/workspace/projects/{id}", "framework": "vite", "packageManager": "bun",
            "scripts": [], "buildTargets": [], "git": git}
    base.update(extra)
    return base


def process(id: str, project_id: str, state: str = "running", started: str = "2026-09-28T11:00:00Z", **extra) -> dict:
    base = {"id": id, "projectId": project_id, "name": id, "command": "bun run dev", "cwd": "/w", "pid": 10,
            "port": None, "display": False, "state": state, "exitCode": None, "startedAt": started, "endedAt": None}
    base.update(extra)
    return base


@pytest.mark.parametrize(("name", "expected"), [
    ("Hello World!!", "hello-world"),
    ("  --My_App..  ", "my_app"),
    ("a   b", "a-b"),
    ("Ünïcode Project", "n-code-project"),
    ("!!!", None),
    ("", None),
    ("x" * 70, "x" * 64),
    ("a" * 63 + "-b", "a" * 63),
])
def test_project_id_from_name_matches_protocol(name, expected):
    assert model.project_id_from_name(name) == expected


def test_validate_project_draft_reports_each_field():
    result = model.validate_project_draft(model.ProjectDraft("", "notaurl", "..bad"))
    assert not result.ok
    assert set(result.errors) == {"name", "git_url", "branch"}


def test_validate_project_draft_rejects_existing_and_symbol_only_names():
    assert "already exists" in model.validate_project_draft(model.ProjectDraft("Hello World"), ["hello-world"]).errors["name"]
    assert model.validate_project_draft(model.ProjectDraft("???")).errors["name"] == "Use at least one letter or digit."
    too_long = model.validate_project_draft(model.ProjectDraft("a" * 129)).errors["name"]
    assert "128" in too_long


def test_validate_project_draft_branch_needs_url():
    result = model.validate_project_draft(model.ProjectDraft("demo", "", "main"))
    assert result.errors == {"branch": "A branch only applies when cloning. Add a git URL or clear it."}


def test_validate_project_draft_ok_trims_values():
    result = model.validate_project_draft(model.ProjectDraft("  Demo App ", " git@github.com:me/demo.git ", " feature/x "))
    assert result.ok
    assert (result.project_id, result.name, result.git_url, result.branch) == (
        "demo-app", "Demo App", "git@github.com:me/demo.git", "feature/x"
    )
    empty = model.validate_project_draft(model.ProjectDraft("demo"))
    assert empty.ok and empty.git_url is None and empty.branch is None


@pytest.mark.parametrize(("url", "ok"), [
    ("https://github.com/octocat/Hello-World.git", True),
    ("ssh://git@host/repo.git", True),
    ("git://host/repo", True),
    ("file:///srv/repo", True),
    ("git@github.com:me/repo.git", True),
    ("notaurl", False),
    ("ftp://host/repo", False),
    ("https://host/with space", False),
])
def test_git_url_pattern(url, ok):
    assert ("git_url" not in model.validate_project_draft(model.ProjectDraft("x", url)).errors) is ok


@pytest.mark.parametrize(("branch", "ok"), [
    ("main", True), ("feature/login", True), ("v1.2.3", True),
    ("-x", False), ("/x", False), (".x", False), ("a..b", False), ("has space", False),
])
def test_branch_pattern(branch, ok):
    errors = model.validate_project_draft(model.ProjectDraft("x", "https://h/r", branch)).errors
    assert ("branch" not in errors) is ok


def test_location_hint_and_create_label():
    assert model.location_hint("My App") == "Created as /workspace/projects/my-app"
    assert model.location_hint("??") == "Becomes a folder in /workspace/projects."
    assert model.create_label("") == "Create"
    assert model.create_label(" https://x/y ") == "Clone"


def test_is_conflict():
    assert model.is_conflict(ApiError(409, "conflict", "exists"))
    assert model.is_conflict(ApiError(400, "conflict", "exists"))
    assert not model.is_conflict(ApiError(400, "bad_request", "nope"))
    assert not model.is_conflict(RuntimeError("x"))


def test_clone_outcome():
    assert model.clone_outcome(None, False).done is False
    ok = model.clone_outcome(0, True)
    assert ok.ok and ok.tone == "success"
    failed = model.clone_outcome(128, True)
    assert not failed.ok and "code 128" in failed.message and failed.tone == "danger"
    killed = model.clone_outcome(None, True)
    assert "stopped before it finished" in killed.message


def test_validate_process_draft():
    missing = model.validate_process_draft(model.ProcessDraft("  "), "demo")
    assert missing.errors == {"command": "Enter a command to run."}
    for port in ("0", "65536", "abc", "-1"):
        assert "port" in model.validate_process_draft(model.ProcessDraft("ls", port=port), "demo").errors
    result = model.validate_process_draft(model.ProcessDraft(" bun run dev ", " web ", "5173", True), "demo")
    assert result.ok
    assert result.body == {"projectId": "demo", "command": "bun run dev", "name": "web", "port": 5173, "display": True}
    plain = model.validate_process_draft(model.ProcessDraft("ls"), "demo")
    assert plain.body == {"projectId": "demo", "command": "ls"}
    long = model.validate_process_draft(model.ProcessDraft("x" * 16_385), "demo")
    assert "command" in long.errors


def test_script_command_quotes_unsafe_names():
    assert model.script_command("bun", "lint:fix") == "bun run lint:fix"
    assert model.script_command(None, "dev") == "npm run dev"
    assert model.script_command("pnpm", "my script") == "pnpm run 'my script'"
    assert model.script_command("yarn", "it's") == "yarn run 'it'\\''s'"


def test_command_label_and_display_preference():
    assert model.command_label(["git", "clone", "x"]) == "git clone x"
    assert model.command_label("ls -la") == "ls -la"
    assert model.prefers_display("electron") and not model.prefers_display("vite")


def test_project_activity_priority():
    procs = [process("p1", "a"), process("p2", "a", "exited"), process("p3", "b")]
    builds = [{"id": "b1", "projectId": "c", "state": "running", "createdAt": "2026-09-28T10:00:00Z"}]
    runs = [{"id": "r1", "projectId": "d", "state": "running", "startedAt": "2026-09-28T10:00:00Z"}]
    running = model.project_activity("a", procs, builds, runs)
    assert (running.kind, running.label, running.running) == ("running", "1 running", 1)
    assert model.project_activity("c", procs, builds, runs).kind == "building"
    assert model.project_activity("d", procs, builds, runs).kind == "agent"
    assert model.project_activity("e", procs, builds, runs).kind == "idle"
    assert model.project_activity("e", None, None, None).label == "Idle"


def test_sort_projects_puts_busy_then_recent_first():
    projects = [
        project("old", "2024-01-01T00:00:00Z"),
        project("recent", "2026-09-27T00:00:00Z"),
        project("nogit"),
        project("busy", "2020-01-01T00:00:00Z"),
        project("touched", "2020-01-01T00:00:00Z"),
    ]
    procs = [
        process("p1", "busy"),
        process("p2", "touched", "exited", started="2026-09-28T09:00:00Z", endedAt="2026-09-28T09:30:00Z"),
    ]
    ordered = [p["id"] for p in model.sort_projects(projects, procs, [], [])]
    assert ordered == ["busy", "touched", "recent", "old", "nogit"]


def test_filter_projects_matches_all_tokens():
    projects = [project("web-app", "2026-01-01T00:00:00Z", buildTargets=["web"]), project("api", framework="python")]
    assert [p["id"] for p in model.filter_projects(projects, "python")] == ["api"]
    assert [p["id"] for p in model.filter_projects(projects, "WEB main")] == ["web-app"]
    assert [p["id"] for p in model.filter_projects(projects, "  ")] == ["web-app", "api"]
    assert model.filter_projects(projects, "web python") == []


def test_card_model_with_and_without_git():
    dirty = project("demo", "2026-09-28T11:00:00Z", buildTargets=["web", "android-apk"])
    dirty["git"].update(dirty=True, ahead=2, behind=1)
    card = model.card_model(dirty, [process("p", "demo")], [], [], NOW)
    assert card.title == "demo" and card.subtitle == "Vite · bun · demo"
    assert card.branch == "main" and card.sync == "↑2 ↓1" and card.dirty == ("Uncommitted changes", "warning")
    assert card.commit == "work on demo" and card.commit_when == "1h ago"
    assert card.tags == ("Web bundle", "Android APK")
    assert card.activity.kind == "running"
    bare = model.card_model(project("bare"), now=NOW)
    assert bare.branch == "Not a git repository" and bare.dirty is None and bare.commit is None and bare.sync is None


@pytest.mark.parametrize(("index", "worktree", "code", "tone", "kind"), [
    ("M", " ", "M", "warning", "Modified"),
    (" ", "M", "M", "warning", "Modified"),
    ("?", "?", "??", "info", "Untracked"),
    ("A", " ", "A", "success", "Added"),
    ("D", " ", "D", "danger", "Deleted"),
    ("U", "U", "UU", "danger", "Conflict"),
    ("R", "M", "RM", "warning", "Renamed"),
    ("", "", "?", "info", "Untracked"),
])
def test_git_file_status(index, worktree, code, tone, kind):
    file = {"path": "x", "index": index, "worktree": worktree}
    assert model.git_file_code(file) == code
    assert model.git_file_tone(file) == tone
    assert model.git_file_kind(file) == kind


def test_process_state_and_meta():
    failed = process("p", "a", "exited", exitCode=2, endedAt="2026-09-28T11:05:00Z")
    assert model.process_state(failed) == ("Failed", "danger")
    assert model.process_state(process("p", "a", "exited", exitCode=0)) == ("Exited", "neutral")
    assert model.process_state(process("p", "a")) == ("Running", "success")
    live = process("p", "a", port=5173, display=True, startedAt="2026-09-28T11:00:00Z")
    assert model.process_meta(live, NOW) == "started 1h ago · :5173 · display · pid 10"
    assert model.process_meta(failed, NOW) == "ran 5m · ended 55m ago · exit 2"


def test_project_processes_live_first_then_newest():
    procs = [
        process("old-live", "a", started="2026-09-01T00:00:00Z"),
        process("new-dead", "a", "stopped", started="2026-09-28T00:00:00Z"),
        process("other", "b"),
        process("mid-dead", "a", "exited", started="2026-09-20T00:00:00Z"),
    ]
    assert [p["id"] for p in model.project_processes(procs, "a")] == ["old-live", "new-dead", "mid-dead"]


def test_build_meta_and_progress():
    running = {"id": "b", "projectId": "a", "target": "web", "profile": "release", "state": "running", "stage": "compile",
               "progress": 0.4, "startedAt": "2026-09-28T11:58:00Z", "endedAt": None, "createdAt": "2026-09-28T11:58:00Z",
               "artifacts": [], "error": None}
    assert model.build_progress(running) == 0.4
    assert model.build_meta(running, NOW) == "Release · 2m ago · compile"
    done = dict(running, state="succeeded", stage=None, endedAt="2026-09-28T11:59:30Z", artifacts=[{}, {}])
    assert model.build_progress(done) is None
    assert model.build_meta(done, NOW) == "Release · 2m ago · 1m 30s · 2 artifacts"
    assert model.build_state(done) == ("Succeeded", "success")
    assert model.target_label("android-apk") == "Android APK" and model.target_platform("web") == "Static files"


def test_run_meta():
    run = {"id": "run_1", "projectId": "a", "prompt": "  fix\n the   build ", "state": "failed",
           "startedAt": "2026-09-28T11:00:00Z", "usage": {"inputTokens": 12000, "outputTokens": 345, "cacheReadTokens": 0, "cacheWriteTokens": 0, "totalTokens": 12345}, "error": "boom"}
    assert model.run_title(run) == "fix the build"
    assert model.run_meta(run, NOW) == "1h ago · 12.3k tokens · boom"
    assert model.run_state(run) == ("Failed", "danger")
    assert model.run_title(dict(run, prompt="")) == "run_1"


def test_project_ports_and_site_url():
    ports = [
        {"port": 8080, "projectId": "a", "url": None, "dnsUrl": None},
        {"port": 3000, "projectId": "a", "url": "http://100.1.2.3:3000", "dnsUrl": "http://box.ts.net:3000"},
        {"port": 5000, "projectId": "b", "url": None, "dnsUrl": None},
    ]
    mine = model.project_ports(ports, "a")
    assert [p["port"] for p in mine] == [3000, 8080]
    assert model.site_url(mine[0]) == "http://100.1.2.3:3000"
    assert model.site_url(mine[1]) is None
    assert model.site_url(mine[1], "172.22.0.2") == "http://172.22.0.2:8080"
    assert model.site_url(mine[1], "fd00::2") == "http://[fd00::2]:8080"
    assert model.host_of("http://172.22.0.2:7700") == "172.22.0.2"
    assert model.host_of(None) is None


def test_log_status():
    assert model.log_status("open") == ("Live", "success")
    assert model.log_status("connecting") == ("Connecting", "warning")
    assert model.log_status("closed", 0, ended=True) == ("Exited 0", "success")
    assert model.log_status("closed", 1, ended=True) == ("Exited 1", "danger")
    assert model.log_status("closed", None, ended=True) == ("Stopped", "neutral")


PUSHED = "2026-09-28T10:00:00Z"


def _changes(*files, baseline=PUSHED):
    return {"projectId": "demo", "baselineAt": baseline, "changes": list(files), "totalBytes": 0, "host": None}


def _file(path, kind="modified", discardable=True):
    return {"path": path, "kind": kind, "sha256": None if kind == "deleted" else "0" * 64, "size": 1, "discardable": discardable}


def _request(kind, status, result=None):
    return {"id": f"{kind}-{status}", "projectId": "demo", "kind": kind, "status": status, "paths": None, "force": False,
            "source": "desktop", "claimedBy": None, "result": result, "error": None, "createdAt": PUSHED, "updatedAt": PUSHED}


def _link():
    from monolith_desktop.syncback.state import Link

    return Link("demo", "/home/me/demo", PUSHED)


def _snapshot(reverted=False):
    from monolith_desktop.syncback.state import Snapshot

    return Snapshot("snap1", "demo", "/home/me/demo", PUSHED, [], reverted=reverted)


def test_client_discards_sandbox_changes(monkeypatch):
    from monolith_desktop.api.client import ControllerClient
    from monolith_desktop.api.paths import rest

    client = ControllerClient("http://sandbox:1", "token")
    sent = []
    monkeypatch.setattr(client, "post", lambda path, body, **_kw: sent.append((path, body)) or {"discarded": []})
    client.sync_discard("demo", ["a.txt"])
    client.sync_discard("demo")
    assert sent == [("/v1/projects/demo/sync/discard", {"paths": ["a.txt"]}), ("/v1/projects/demo/sync/discard", {})]
    assert rest.project_sync_discard("my app") == "/v1/projects/my%20app/sync/discard"


def test_sync_blockers_enable_every_action_when_possible():
    view = model.SyncView(_link(), _changes(_file("a.txt")), (), (_snapshot(),))
    assert model.sync_blockers(view) == {"pull": None, "get": None, "revert": None, "discard": None}


def test_sync_blockers_explain_why_an_action_is_off():
    blocked = model.SYNC_BLOCKED
    loading = model.sync_blockers(model.SyncView(_link()))
    assert loading["pull"] == loading["get"] == loading["discard"] == blocked["loading"]
    assert loading["revert"] == blocked["no_snapshot"]
    failed = model.sync_blockers(model.SyncView(_link(), error=RuntimeError("down")))
    assert failed["discard"] == blocked["unavailable"]

    unlinked = model.sync_blockers(model.SyncView(None, _changes(_file("a.txt")), (), (_snapshot(),)))
    assert unlinked["pull"] == unlinked["get"] == unlinked["revert"] == blocked["not_linked"]
    assert unlinked["discard"] is None

    never = model.sync_blockers(model.SyncView(_link(), _changes(baseline=None)))
    assert never["pull"] == never["get"] == never["discard"] == blocked["never_pushed"]

    clean = model.sync_blockers(model.SyncView(_link(), _changes()))
    assert clean["pull"] == blocked["nothing_to_sync"] and clean["discard"] == blocked["nothing_to_discard"]
    assert clean["get"] is None

    kept = model.sync_blockers(model.SyncView(_link(), _changes(_file("a.txt", discardable=False), {**_file("b.txt"), "discardable": None})))
    assert kept["discard"] == blocked["not_discardable"] and kept["pull"] is None

    pending = model.SyncView(_link(), _changes(_file("a.txt")), (_request("pull", "pending"),), (_snapshot(),))
    assert set(model.sync_blockers(pending).values()) == {blocked["active"]}
    assert set(model.sync_blockers(model.SyncView(_link(), _changes(_file("a.txt")), (), (_snapshot(),)), busy=True).values()) == {blocked["active"]}

    reverted = model.sync_blockers(model.SyncView(_link(), _changes(_file("a.txt")), (), (_snapshot(reverted=True),)))
    assert reverted["revert"] == blocked["no_snapshot"]


def test_discardable_and_get_conflicts():
    view = model.SyncView(_link(), _changes(_file("a.txt"), _file("b.txt", "added"), _file("c.txt", discardable=False)))
    assert [change["path"] for change in view.discardable] == ["a.txt", "b.txt"]
    conflicted = _request("get", "failed", {"added": 0, "modified": 0, "deleted": 0, "conflicts": ["a.txt"], "snapshotId": None, "hostPath": None})
    assert model.SyncView(requests=(conflicted, _request("get", "applied"))).get_conflicts == ["a.txt"]
    assert model.SyncView(requests=(_request("get", "applied"), conflicted)).get_conflicts == []
    assert model.SyncView(requests=(_request("pull", "failed"),)).get_conflicts == []


def test_discard_summary():
    changes = _changes()
    assert model.discard_summary({"discarded": ["a.txt", "b.txt"], "unavailable": [], "backupPath": None, "changes": changes}) == (
        "Discarded 2 files in the sandbox", "success",
    )
    message, tone = model.discard_summary(
        {"discarded": ["a.txt"], "unavailable": ["big.bin"], "backupPath": "/data/sync/backups/demo/x", "changes": changes}
    )
    assert tone == "warning"
    assert message.splitlines() == [
        "Discarded 1 file in the sandbox",
        "1 file kept, the sandbox has no copy of the synced version: big.bin",
        "Previous versions saved in /data/sync/backups/demo/x",
    ]
    assert model.discard_summary({"discarded": [], "unavailable": [], "backupPath": None, "changes": changes}) == (
        "Nothing was discarded", "warning",
    )


def test_load_sync_view_reads_changes_for_unlinked_projects(tmp_path):
    from monolith_desktop.syncback.state import SyncState

    class Client:
        def sync_changes(self, project_id):
            return _changes(_file("a.txt"))

        def list_sync_requests(self, project_id):
            return [_request("get", "applied")]

    view = model.load_sync_view(Client(), SyncState(tmp_path), "demo")
    assert view.link is None and [c["path"] for c in view.files] == ["a.txt"] and len(view.requests) == 1
    assert model.sync_blockers(view)["discard"] is None


def test_claude_account_options_and_effective():
    accounts = {
        "defaultAccountId": "claude",
        "accounts": [
            {"id": "claude", "account": {"email": "dev@example.com"}},
            {"id": "claude-work", "account": None},
        ],
    }
    default = project("app")
    pinned = project("app", claudeAccountId="claude-old")
    assert model.claude_account_options(default, accounts) == [
        ("", "Default (claude)"), ("claude", "claude · dev@example.com"), ("claude-work", "claude-work")
    ]
    assert model.claude_account_options(pinned, accounts)[-1] == ("claude-old", "claude-old")
    assert model.effective_claude_account(default, accounts) == "claude"
    assert model.effective_claude_account(pinned, accounts) == "claude-old"
    assert model.effective_claude_account(default, None) is None
    assert model.claude_account_label(project("app", claudeAccountId="claude-work"), None) == "Claude · claude-work"
    assert model.project_claude_account(project("app", claudeAccountId=None)) is None
