from tesseract_desktop.pages.terminals import model


def info(id: str, state: str = "running", created: str = "2026-01-01T00:00:00Z", **extra):
    base = {
        "id": id, "kind": "shell", "projectId": None, "title": "", "cwd": "/workspace", "pid": 1,
        "cols": 80, "rows": 24, "state": state, "exitCode": None, "createdAt": created,
    }
    base.update(extra)
    return base


def test_parse_open_params():
    assert model.parse_open(None) is None
    assert model.parse_open({}) is None
    assert model.parse_open({"terminalId": "trm_1"}) == model.AttachRequest("trm_1")
    assert model.parse_open({"kind": "claude", "projectId": "app"}) == model.LaunchRequest("claude", "app")
    assert model.parse_open({"kind": "shell", "projectId": ""}) == model.LaunchRequest("shell", None)
    assert model.parse_open({"kind": "python"}) is None


def test_sort_running_first_then_newest():
    items = [
        info("a", "exited", "2026-01-03T00:00:00Z"),
        info("b", "running", "2026-01-01T00:00:00Z"),
        info("c", "running", "2026-01-02T00:00:00Z"),
    ]
    assert [t["id"] for t in model.sort_sessions(items)] == ["c", "b", "a"]
    assert model.sort_sessions(None) == []


def test_titles_use_project_names():
    projects = [{"id": "app", "name": "My App"}]
    assert model.session_title(info("a", projectId="app", kind="claude"), projects) == "Claude Code · My App"
    assert model.session_title(info("a"), projects) == "Shell · Workspace"
    assert model.project_label("gone", projects) == "gone"


def test_subtitle_and_status():
    now = 1767225600.0 + 600
    assert model.session_subtitle(info("a"), now) == "started 10m ago · 80×24"
    assert model.session_subtitle(info("a", "exited"), now) == "started 10m ago"
    assert model.session_subtitle(info("a", created=""), now) == "80×24"
    assert model.info_status(info("a", "exited", exitCode=2)) == ("Exited (2)", "neutral")
    assert model.info_status(info("a")) == ("Running", "success")


def test_row_model_marks_exited():
    row = model.row_model(info("a", "exited"), None)
    assert not row.running and row.icon == "terminal"


def test_state_badges_and_banners():
    assert model.state_badge("open") == ("Live", "success")
    assert model.state_badge("exited", 0) == ("Exited (0)", "neutral")
    assert model.banner("open") is None
    exited = model.banner("exited", 3)
    assert exited.action == "restart" and exited.tone == "danger" and "3" in exited.message
    assert model.banner("exited", 0).tone == "neutral"
    assert model.banner("closed", error="boom").action == "reconnect"
    assert model.banner("reconnecting").action is None


def test_merge_info_placeholder():
    placeholder = model.merge_info(None, "trm_x")
    assert placeholder["id"] == "trm_x" and placeholder["state"] == "running"
    existing = info("a")
    assert model.merge_info(existing, "a") is existing
