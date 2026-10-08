from datetime import datetime, timedelta, timezone

from tesseract_desktop.config.model import ConnectionConfig
from tesseract_desktop.services.connection_view import connection_label, status_title
from tesseract_desktop.store import ConnectionState
from tesseract_desktop.theme.css import css_var
from tesseract_desktop.theme.extras.chrome import rules
from tesseract_desktop.theme.extras.sidebar import rules as sidebar_rules
from tesseract_desktop.widgets.sidebar_composer import composer_params
from tesseract_desktop.theme.tokens import SIDEBAR_WIDTH, SIDEBAR_WIDTH_RANGE
from tesseract_desktop.widgets.sidebar_model import (
    clamp_sidebar_width,
    dragged_sidebar_width,
    project_items,
    run_title,
    running_total,
    stored_sidebar_width,
    workspace_state,
)
from tesseract_desktop.widgets.window_controls import decoration_buttons

NOW = datetime(2026, 9, 28, 12, 0, tzinfo=timezone.utc)


def iso(minutes_ago: float) -> str:
    return (NOW - timedelta(minutes=minutes_ago)).isoformat().replace("+00:00", "Z")


def project(pid: str, name: str, commit_minutes_ago: float | None = None) -> dict:
    git = None
    if commit_minutes_ago is not None:
        git = {"branch": "main", "dirty": False, "ahead": 0, "behind": 0,
               "lastCommit": {"sha": "abc", "subject": "s", "date": iso(commit_minutes_ago)}}
    return {"id": pid, "name": name, "path": f"/workspace/{name}", "framework": "node", "packageManager": "npm",
            "scripts": [], "buildTargets": [], "git": git}


def run(rid: str, project_id: str | None, state: str, started: float, prompt: str = "Do it", ended: float | None = None) -> dict:
    return {"id": rid, "projectId": project_id, "prompt": prompt, "sessionId": None, "state": state,
            "startedAt": iso(started), "endedAt": iso(ended) if ended is not None else None,
            "usage": None, "result": None, "error": None}


def test_decoration_buttons_follow_layout_and_always_close():
    assert decoration_buttons("icon:minimize,maximize,close") == ("minimize", "maximize", "close")
    assert decoration_buttons("close,maximize:menu") == ("maximize", "close")
    assert decoration_buttons("appmenu:close") == ("close",)
    assert decoration_buttons("") == ("close",)
    assert decoration_buttons(None) == ("close",)


def test_run_title_uses_first_non_empty_line_and_truncates():
    assert run_title("\n  Fix the login bug  \nmore details") == "Fix the login bug"
    assert run_title("") == ""
    assert run_title(None) == ""
    long = "x" * 200
    title = run_title(long, max_chars=20)
    assert len(title) == 20 and title.endswith("…")


def test_projects_sorted_by_running_then_recency():
    projects = [project("a", "alpha", commit_minutes_ago=5), project("b", "beta"), project("c", "gamma", 600)]
    runs = [
        run("r1", "b", "running", 30),
        run("r2", "b", "running", 10),
        run("r3", "c", "succeeded", 1, ended=0.5),
        run("r4", "a", "failed", 120, ended=110),
    ]
    items = project_items(projects, runs)
    assert [item.id for item in items] == ["b", "c", "a"]
    beta = items[0]
    assert beta.running == 2 and beta.active
    assert [r.id for r in beta.runs] == ["r2", "r1"]
    assert running_total(items) == 2


def test_runs_order_running_first_and_limit():
    runs = [run(f"r{i}", "a", "succeeded", i, ended=i - 0.5) for i in range(1, 9)]
    runs.append(run("live", "a", "running", 500))
    item = project_items([project("a", "alpha")], runs, limit=3)[0]
    assert [r.id for r in item.runs] == ["live", "r1", "r2"]
    assert item.runs[0].running and item.runs[0].tone == "info"
    assert item.runs[1].tone == "success"


def test_unassigned_runs_group_is_last_and_optional():
    projects = [project("a", "alpha")]
    runs = [run("r1", None, "running", 1), run("r2", "gone", "failed", 2, ended=1)]
    assert [item.id for item in project_items(projects, runs)] == ["a"]
    items = project_items(projects, runs, unassigned_name="No project")
    assert [item.id for item in items] == ["a", None]
    assert items[-1].name == "No project"
    assert {r.id for r in items[-1].runs} == {"r1", "r2"}


def test_project_without_name_falls_back_to_id():
    items = project_items([{**project("p1", "x"), "name": ""}], [])
    assert items[0].name == "p1"


def test_workspace_state():
    assert workspace_state(True, None, 0) == "loading"
    assert workspace_state(False, None, 0) == "offline"
    assert workspace_state(True, [], 0) == "empty"
    assert workspace_state(False, [], 0) == "offline"
    assert workspace_state(False, [project("a", "a")], 1) == "ready"


def test_composer_params():
    assert composer_params("   ", "p1") is None
    assert composer_params(" hi \n", None) == {"prompt": "hi", "send": True}
    assert composer_params("hi", "p1") == {"prompt": "hi", "send": True, "projectId": "p1"}
    assert composer_params("hi", None, ["upl_1"]) == {"prompt": "hi", "send": True, "attachmentIds": ["upl_1"]}
    assert composer_params("hi", None, []) == {"prompt": "hi", "send": True}


def test_status_title_and_label_without_name():
    config = ConnectionConfig(api_url="http://x:7700", token="t", name="box", source="file")
    state = ConnectionState(status="online", config=config)
    assert status_title(state) == "box"
    assert connection_label(state) == "box · Online"
    assert connection_label(state, with_name=False) == "Online"
    assert status_title(ConnectionState()) == "Sandbox"


def test_chrome_rules_cover_both_schemes_without_titlebutton_selectors():
    for scheme in ("light", "dark"):
        ruleset = rules(scheme)
        assert "headerbar.to-titlebar button.to-window-control" in ruleset
        assert "window.to-main-window" in ruleset
        assert not any("titlebutton" in selector for selector in ruleset)
        assert all(props for props in ruleset.values())
        assert not any(key in ("margin-start", "margin-end") for props in ruleset.values() for key in props)


def test_sidebar_rules_are_flat_and_scoped():
    for scheme in ("light", "dark", "graphite"):
        ruleset = sidebar_rules(scheme)
        assert "list.to-nav-list > row:selected" in ruleset
        assert not any(".to-canvas" in selector for selector in ruleset)
        assert not any("gradient" in value for props in ruleset.values() for value in props.values())
        assert all(".to-side-composer" in selector for selector in ruleset if "composer" in selector)


def test_sidebar_width_is_clamped_to_range():
    low, high = SIDEBAR_WIDTH_RANGE
    assert low < SIDEBAR_WIDTH < high
    assert clamp_sidebar_width(low - 50) == low
    assert clamp_sidebar_width(high + 50) == high
    assert clamp_sidebar_width(301.4) == 301


def test_stored_sidebar_width_falls_back_to_default():
    low, high = SIDEBAR_WIDTH_RANGE
    assert stored_sidebar_width(None) == SIDEBAR_WIDTH
    assert stored_sidebar_width("300") == SIDEBAR_WIDTH
    assert stored_sidebar_width(True) == SIDEBAR_WIDTH
    assert stored_sidebar_width(float("nan")) == SIDEBAR_WIDTH
    assert stored_sidebar_width(310) == 310
    assert stored_sidebar_width(10_000) == high
    assert stored_sidebar_width(0) == low


def test_dragged_sidebar_width_is_in_unzoomed_units():
    assert dragged_sidebar_width(250, 30, 1.0) == 280
    assert dragged_sidebar_width(250, 30, 1.5) == 270
    assert dragged_sidebar_width(250, -600, 1.5) == SIDEBAR_WIDTH_RANGE[0]
    assert dragged_sidebar_width(250, 600, 1.0) == SIDEBAR_WIDTH_RANGE[1]


def test_sidebar_resize_handle_highlights_on_hover():
    css = sidebar_rules("graphite")
    assert "min-width" in css[".to-resize-handle"]
    assert css_var("borderStrong") in css[".to-resize-handle:hover, .to-resize-handle.dragging"]["box-shadow"]
