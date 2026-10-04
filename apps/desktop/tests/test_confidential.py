import json
import random

from monolith_desktop import sync
from monolith_desktop.api.client import ControllerClient
from monolith_desktop.api.paths import rest
from monolith_desktop.pages.projects import model
from monolith_desktop.pseudonym import ADJECTIVES, NOUNS, pseudonym
from monolith_desktop.syncback import SyncState
from monolith_desktop.syncback.requests import handle_request
from monolith_desktop.syncback.state import REDACTED, Link
from monolith_desktop.widgets.sidebar_model import project_items
from test_projects import project
from test_syncback import FakeController, PROJECT, sandbox_edits, write


def test_pseudonym_is_an_adjective_noun_project_id():
    rng = random.Random(7)
    for _ in range(200):
        name = pseudonym(rng=rng)
        adjective, noun = name.split("-")
        assert adjective in ADJECTIVES and noun in NOUNS
        assert model.project_id_from_name(name) == name


def test_word_lists_are_short_unique_lowercase_ascii():
    for words in (ADJECTIVES, NOUNS):
        assert len(words) >= 60 and len(set(words)) == len(words)
        assert all(word.isascii() and word.isalpha() and word.islower() and len(word) <= 8 for word in words)


def test_pseudonym_avoids_taken_names():
    rng = random.Random(1)
    taken: set[str] = set()
    for _ in range(300):
        name = pseudonym(taken, rng)
        assert name not in taken
        taken.add(name)


def test_pseudonym_falls_back_to_a_numeric_suffix():
    every = {f"{a}-{n}" for a in ADJECTIVES for n in NOUNS}
    name = pseudonym(every, random.Random(3))
    base, _, suffix = name.rpartition("-")
    assert base in every and suffix == "2"
    assert pseudonym(every | {name}, random.Random(3)) == f"{base}-3"
    assert model.project_id_from_name(name) == name


def test_link_round_trips_the_confidential_flag():
    link = Link("morning-cat", "/home/me/Secret Thing", "2026-10-01T00:00:00.000Z", {"a": "1"}, confidential=True)
    data = link.to_json()
    assert data["confidential"] is True
    assert Link.from_json("morning-cat", json.loads(json.dumps(data))) == link
    plain = Link("demo", "/home/me/demo", "2026-10-01T00:00:00.000Z")
    assert "confidential" not in plain.to_json()
    assert Link.from_json("demo", plain.to_json()).confidential is False


def test_link_redacts_the_host_path_only_when_confidential():
    secret = Link("morning-cat", "/home/me/acme-billing", "", confidential=True)
    assert secret.shared_path == REDACTED
    assert secret.redact("/home/me/acme-billing/x changed in acme-billing") == f"{REDACTED}/x changed in {REDACTED}"
    plain = Link("demo", "/home/me/demo", "")
    assert plain.shared_path == "/home/me/demo" and plain.redact("/home/me/demo") == "/home/me/demo"


class Pusher:
    def __init__(self, projects=None):
        self.calls: list[tuple[str, bool]] = []
        self.projects = projects or []

    def list_projects(self):
        return self.projects

    def sync_project(self, project_id, archive, size, confidential=False):
        self.calls.append((project_id, confidential))
        return {"path": f"/workspace/projects/{project_id}"}, True


def test_run_sync_confidential_uses_a_pseudonym_and_reuses_the_link(tmp_path, monkeypatch):
    root = tmp_path / "Acme Billing"
    write(root, "index.ts", "x")
    pusher = Pusher([{"id": "taken"}])
    monkeypatch.setattr(sync, "connect", lambda: (pusher, "sandbox"))
    seen = []
    monkeypatch.setattr(sync, "pseudonym", lambda taken: seen.append(list(taken)) or "quiet-heron")
    state = SyncState(tmp_path / "state")
    state.save_link(Link("other", str(tmp_path / "elsewhere"), ""))

    assert sync.run_sync(str(root), state, confidential=True) == 0
    assert pusher.calls == [("quiet-heron", True)]
    assert sorted(seen[0]) == ["other", "taken"]
    link = state.link("quiet-heron")
    assert link.confidential and link.host_path == str(root.resolve())
    assert "acme" not in json.dumps(pusher.calls).lower()

    assert sync.run_sync(str(root), state) == 0
    assert pusher.calls[-1] == ("quiet-heron", True)
    assert len(seen) == 1 and state.link("quiet-heron").confidential


def test_run_sync_ignores_a_failing_project_list(tmp_path, monkeypatch):
    from monolith_desktop.api.errors import NetworkError

    class Offline(Pusher):
        def list_projects(self):
            raise NetworkError("down")

    root = tmp_path / "secret"
    write(root, "a.txt", "x")
    pusher = Offline()
    monkeypatch.setattr(sync, "connect", lambda: (pusher, "sandbox"))
    assert sync.run_sync(str(root), SyncState(tmp_path / "state"), confidential=True) == 0
    project_id, confidential = pusher.calls[0]
    assert confidential and project_id != "secret" and model.project_id_from_name(project_id) == project_id


def test_run_sync_without_the_flag_keeps_the_folder_name(tmp_path, monkeypatch):
    root = tmp_path / "My App"
    write(root, "a.txt", "x")
    pusher = Pusher()
    monkeypatch.setattr(sync, "connect", lambda: (pusher, "sandbox"))
    state = SyncState(tmp_path / "state")
    assert sync.run_sync(str(root), state) == 0
    assert pusher.calls == [("my-app", False)]
    assert not state.link("my-app").confidential


def test_run_sync_relinks_a_project_synced_under_its_real_name(tmp_path, monkeypatch, capsys):
    root = tmp_path / "My App"
    write(root, "a.txt", "x")
    pusher = Pusher()
    monkeypatch.setattr(sync, "connect", lambda: (pusher, "sandbox"))
    state = SyncState(tmp_path / "state")
    assert sync.run_sync(str(root), state) == 0
    assert sync.run_sync(str(root), state, confidential=True) == 0
    project_id, confidential = pusher.calls[-1]
    assert confidential and project_id != "my-app"
    assert set(state.links()) == {project_id} and state.link(project_id).confidential
    assert "/workspace/projects/my-app" in capsys.readouterr().err
    assert sync.run_sync(str(root), state) == 0
    assert pusher.calls[-1] == (project_id, True)


def test_client_sends_the_confidential_flag(monkeypatch):
    client = ControllerClient("http://sandbox:1", "token")
    sent = []
    monkeypatch.setattr(client, "post", lambda path, body: sent.append((path, body)) or {})
    client.create_project("morning-cat", confidential=True)
    client.create_project("demo")
    assert sent == [("/v1/projects", {"name": "morning-cat", "confidential": True}), ("/v1/projects", {"name": "demo"})]
    assert rest.project_sync("morning-cat", 1) == "/v1/projects/morning-cat/sync?confidential=1"
    assert rest.project_sync("demo") == "/v1/projects/demo/sync"


def test_validate_project_draft_carries_confidential():
    result = model.validate_project_draft(model.ProjectDraft("morning-cat", confidential=True))
    assert result.ok and result.confidential and result.project_id == "morning-cat"
    assert not model.validate_project_draft(model.ProjectDraft("demo")).confidential
    assert "already exists" in model.validate_project_draft(
        model.ProjectDraft("morning-cat", confidential=True), ["morning-cat"]
    ).errors["name"]


def test_card_model_and_search_show_confidential_projects():
    secret = project("morning-cat", confidential=True)
    assert model.card_model(secret).confidential == ("Confidential", "warning")
    assert model.card_model(project("demo")).confidential is None
    assert model.matches(secret, "confidential") and not model.matches(project("demo"), "confidential")
    items = project_items([secret, project("demo")], [])
    assert {item.id: item.confidential for item in items} == {"morning-cat": True, "demo": False}


def test_requests_for_confidential_links_never_send_the_host_path(tmp_path):
    host = tmp_path / "acme-billing"
    sandbox = tmp_path / "sandbox"
    for root in (host, sandbox):
        write(root, "src/app.py", "print('v1')\n")
        write(root, "src/old.py", "old\n")
    state = SyncState(tmp_path / "state")
    from monolith_desktop.syncback.manifest import build_manifest
    from test_syncback import walk

    state.save_link(Link(PROJECT, str(host.resolve()), "", build_manifest(host, walk(host)), confidential=True))
    controller = FakeController(sandbox)
    controller.push()
    sandbox_edits(sandbox)
    request = controller.add_request("pull")
    assert handle_request(controller, state, request, "laptop").ok
    assert controller.requests[request["id"]]["result"]["hostPath"] == REDACTED

    write(host, "src/app.py", "host edit\n")
    write(sandbox, "src/app.py", "print('v3')\n")
    failed = controller.add_request("pull")
    assert not handle_request(controller, state, failed, "laptop").ok
    stored = controller.requests[failed["id"]]
    assert stored["result"]["hostPath"] == REDACTED
    assert "acme" not in json.dumps(stored)
