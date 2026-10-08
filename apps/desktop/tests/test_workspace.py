import pytest

from tesseract_desktop.api.client import _run_selection
from tesseract_desktop.api.paths import rest
from tesseract_desktop.services.workspace import apply_run, remove_ids


def run(**overrides):
    base = {"id": "r1", "state": "succeeded", "startedAt": "2026-09-28T10:00:00Z", "archivedAt": None}
    base.update(overrides)
    return base


def test_apply_run_keeps_lists_split_by_archived_state():
    active = [run(id="r1"), run(id="r2")]
    archived_r1 = run(id="r1", archivedAt="2026-09-28T11:00:00Z")
    assert [r["id"] for r in apply_run(active, archived_r1)] == ["r2"]
    assert apply_run([], archived_r1, archived=True) == [archived_r1]
    assert apply_run([archived_r1], run(id="r1"), archived=True) == []
    assert [r["id"] for r in apply_run(active, run(id="r3"))] == ["r3", "r1", "r2"]
    assert apply_run(active, run(id="r2", state="failed"))[1]["state"] == "failed"


def test_remove_ids():
    runs = [run(id="r1"), run(id="r2"), run(id="r3")]
    assert [r["id"] for r in remove_ids(runs, ["r1", "r3", "missing"])] == ["r2"]
    assert remove_ids(None, ["r1"]) == []


def test_agent_run_paths_and_selection():
    assert rest.agent_runs() == "/v1/agent/runs"
    assert rest.agent_runs(None, "1") == "/v1/agent/runs?archived=1"
    assert rest.agent_runs_archive() == "/v1/agent/runs/archive"
    assert rest.agent_runs_delete() == "/v1/agent/runs/delete"
    assert _run_selection(["a"], False, None) == {"ids": ["a"]}
    assert _run_selection(None, True, "p1") == {"all": True, "projectId": "p1"}
    with pytest.raises(ValueError):
        _run_selection([], False, None)
