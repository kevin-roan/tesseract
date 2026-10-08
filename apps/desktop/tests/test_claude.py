import json
from pathlib import Path

import pytest

from tesseract_desktop.api.errors import ProtocolError
from tesseract_desktop.api.client import ControllerClient
from tesseract_desktop.api.types import parse_claude_account_list, parse_claude_auth_status
from tesseract_desktop.claude import model
from tesseract_desktop.claude.host import HostPaths, host_accounts, host_paths, read_host_state, read_host_states

OAUTH = {
    "accessToken": "sk-ant-oat-access",
    "refreshToken": "sk-ant-ort-refresh",
    "expiresAt": 2_000_000_000_000,
    "scopes": ["user:inference"],
    "subscriptionType": "max",
    "rateLimitTier": "default",
}
GLOBAL = {
    "oauthAccount": {"emailAddress": "dev@example.com", "organizationName": "Acme", "displayName": "Dev"},
    "userID": "u1",
    "hasCompletedOnboarding": True,
    "theme": "dark",
    "projects": {"/home/dev/x": {}},
    "cachedStatsig": {"a": 1},
}
STATUS = {
    "available": True,
    "method": "oauth_token",
    "loggedIn": True,
    "sources": {"oauthToken": True, "credentials": False, "apiKey": False},
    "oauthTokenFromEnv": False,
    "account": {"email": "dev@example.com", "displayName": None, "organization": "Acme"},
    "subscriptionType": "max",
    "credentialsExpiresAt": None,
    "settingsPresent": True,
    "configDir": "/home/dev/.claude",
    "importedAt": None,
}

PROFILE = {
    "id": "claude-work",
    "primary": False,
    "present": True,
    "loggedIn": True,
    "account": {"email": "dev@work.example", "displayName": None, "organization": "Work"},
    "subscriptionType": "team",
    "credentialsExpiresAt": "2033-05-18T03:33:20Z",
    "settingsPresent": False,
    "configDir": "/home/dev/.claude-work",
}
ACCOUNTS = {
    "defaultAccountId": "claude-work",
    "accounts": [
        {**PROFILE, "id": "claude", "primary": True, "account": None, "subscriptionType": None,
         "credentialsExpiresAt": None, "loggedIn": False, "configDir": "/home/dev/.claude"},
        PROFILE,
        {**PROFILE, "id": "claude-personal", "present": False, "loggedIn": False, "configDir": "/home/dev/.claude-personal"},
    ],
}


@pytest.fixture
def claude_home(tmp_path: Path) -> HostPaths:
    config = tmp_path / ".claude"
    (config / "skills" / "review").mkdir(parents=True)
    (config / "agents").mkdir()
    (config / "skills" / ".git").mkdir()
    (config / ".credentials.json").write_text(json.dumps({"claudeAiOauth": OAUTH}))
    (config / "settings.json").write_text('{"model": "opus"}')
    (config / "CLAUDE.md").write_text("Be brief ✓")
    (config / "skills" / "review" / "SKILL.md").write_text("# Review")
    (config / "skills" / "review" / "logo.png").write_bytes(b"\x89PNG\x00\x01")
    (config / "skills" / "review" / "latin1.txt").write_bytes("caf\xe9".encode("latin-1"))
    (config / "skills" / "review" / "big.md").write_text("x" * 1024)
    (config / "skills" / ".git" / "HEAD").write_text("ref")
    (config / "agents" / "planner.md").write_text("agent")
    (config / "agents" / "link.md").symlink_to(config / "CLAUDE.md")
    (config / "projects").mkdir()
    (config / "projects" / "session.jsonl").write_text("{}")
    (tmp_path / ".claude.json").write_text(json.dumps(GLOBAL))
    return HostPaths(config, tmp_path / ".claude.json")


def test_host_paths_follow_env(tmp_path: Path):
    default = host_paths({}, home=tmp_path)
    assert default == HostPaths(tmp_path / ".claude", tmp_path / ".claude.json")
    custom = host_paths({"CLAUDE_CONFIG_DIR": str(tmp_path / "cfg")}, home=tmp_path)
    assert custom == HostPaths(tmp_path / "cfg", tmp_path / "cfg" / ".claude.json")


def test_read_host_state_summarises_without_secrets(claude_home: HostPaths):
    state = read_host_state(claude_home, platform="linux")
    assert state.logged_in and state.login_issue is None
    assert (state.email, state.organization, state.subscription_type) == ("dev@example.com", "Acme", "max")
    assert state.expires_at == 2_000_000_000
    assert state.settings_present and state.claude_md_present
    assert state.extension_counts == {"skills": 4, "agents": 1, "commands": 0, "output-styles": 0}
    assert "sk-ant" not in repr(state)


def test_read_host_state_missing_and_macos(tmp_path: Path):
    empty = HostPaths(tmp_path / ".claude", tmp_path / ".claude.json")
    state = read_host_state(empty, platform="linux")
    assert not state.logged_in and state.login_issue == "missing"
    assert not state.settings_present and not state.claude_md_present and state.email is None
    assert not any(state.extension_counts.values())
    assert read_host_state(empty, platform="darwin").login_issue == "keychain"


def test_invalid_credentials_file(claude_home: HostPaths):
    (claude_home.config_dir / ".credentials.json").write_text('{"claudeAiOauth": {}}')
    assert read_host_state(claude_home, platform="linux").login_issue == "invalid"


def test_parse_auth_status_and_defaults():
    assert parse_claude_auth_status(STATUS) == STATUS
    loose = parse_claude_auth_status({"method": "weird", "loggedIn": "yes", "sources": None})
    assert loose["method"] == "none" and loose["loggedIn"] is False
    assert loose["sources"] == {"oauthToken": False, "credentials": False, "apiKey": False}
    assert loose["account"] is None and loose["configDir"] == ""
    with pytest.raises(ProtocolError):
        parse_claude_auth_status(None)


def test_model_rows(claude_home: HostPaths):
    state = read_host_state(claude_home, platform="linux")
    rows = dict(model.host_rows(state, now=2_000_000_000 - 7200))
    assert rows["Login"] == "Signed in"
    assert rows["Account"] == "dev@example.com · Acme"
    assert rows["Access token"] == "Expires in 2h"
    assert rows["Plan"] == "Max"
    assert rows["Settings"] == "settings.json · CLAUDE.md · 4 skill files · 1 agent file"
    assert model.format_expiry(100.0, now=100.0 + 3600).startswith("Expired 1h ago")

    sandbox = dict(model.sandbox_rows(parse_claude_auth_status(STATUS)))
    assert sandbox["Status"] == "Signed in with a long-lived token"
    assert "Last copy" not in sandbox
    env = parse_claude_auth_status({**STATUS, "oauthTokenFromEnv": True})
    assert "environment" in model.method_label(env)
    creds = parse_claude_auth_status({**STATUS, "method": "credentials", "credentialsExpiresAt": "2033-05-18T03:33:20Z"})
    assert model.method_label(creds) == "Signed in with this computer's login"
    assert dict(model.sandbox_rows(creds, now=2_000_000_000 - 7200))["Access token"] == "Expires in 2h"
    assert model.method_label(parse_claude_auth_status({**STATUS, "available": False})).startswith("Claude Code is not")


def test_sandbox_error_message_flags_outdated_controller():
    from tesseract_desktop.api.errors import ApiError
    from tesseract_desktop.claude.model import sandbox_error_message
    from tesseract_desktop.strings import CLAUDE

    assert sandbox_error_message(ApiError(404, "not_found", "No route for GET /v1/claude/auth")) == CLAUDE["outdated"]
    assert sandbox_error_message(ApiError(500, "internal", "boom")) != CLAUDE["outdated"]


def _account_dir(home: Path, name: str, email: str, credentials: bool = True) -> Path:
    config = home / name
    config.mkdir()
    if credentials:
        (config / ".credentials.json").write_text(json.dumps({"claudeAiOauth": {**OAUTH, "subscriptionType": "pro"}}))
    (config / ".claude.json").write_text(json.dumps({"oauthAccount": {"emailAddress": email}}))
    return config


def test_host_accounts_discovers_alias_dirs(claude_home: HostPaths):
    home = claude_home.config_dir.parent
    work = _account_dir(home, ".claude-work", "dev@work.example")
    _account_dir(home, ".claude-personal", "me@home.example")
    _account_dir(home, ".claude-nologin", "x@example.com", credentials=False)
    _account_dir(home, ".claude-Bad", "y@example.com")
    (home / ".claude-file").write_text("not a dir")

    accounts = host_accounts({}, home=home)
    assert [account.id for account in accounts] == ["claude", "claude-personal", "claude-work"]
    assert accounts[0].paths == claude_home
    assert accounts[2].paths == HostPaths(work, work / ".claude.json")

    states = read_host_states({}, home=home, platform="linux")
    assert [(state.account_id, state.email, state.subscription_type) for state in states] == [
        ("claude", "dev@example.com", "max"),
        ("claude-personal", "me@home.example", "pro"),
        ("claude-work", "dev@work.example", "pro"),
    ]
    assert "sk-ant" not in repr(states)
    assert model.host_account_subtitle(states[2]) == f"dev@work.example · {work}"


def test_host_accounts_skips_primary_override_and_missing_home(tmp_path: Path):
    work = _account_dir(tmp_path, ".claude-work", "dev@work.example")
    accounts = host_accounts({"CLAUDE_CONFIG_DIR": str(work)}, home=tmp_path)
    assert [(account.id, account.paths.config_dir) for account in accounts] == [("claude", work)]
    assert [account.id for account in host_accounts({}, home=tmp_path / "missing")] == ["claude"]


def test_parse_account_list_and_defaults():
    assert parse_claude_account_list(ACCOUNTS) == ACCOUNTS
    loose = parse_claude_account_list({"accounts": [{"id": ""}, None, {"id": "claude", "present": "yes"}]})
    assert loose["defaultAccountId"] == "claude"
    assert [(profile["id"], profile["present"], profile["configDir"]) for profile in loose["accounts"]] == [("claude", False, "")]
    with pytest.raises(ProtocolError):
        parse_claude_account_list([])


def test_account_choices():
    choices = model.account_choices(parse_claude_account_list(ACCOUNTS), now=2_000_000_000 - 7200)
    assert [(choice.id, choice.title, choice.available) for choice in choices] == [
        ("claude", "claude · primary", True),
        ("claude-work", "claude-work", True),
        ("claude-personal", "claude-personal", False),
    ]
    assert choices[0].subtitle.splitlines() == ["—", "— · Not signed in", "/home/dev/.claude"]
    assert choices[1].subtitle.splitlines() == [
        "dev@work.example · Work", "Team · Signed in · Expires in 2h", "/home/dev/.claude-work"
    ]
    assert "Not linked into the sandbox" in choices[2].subtitle
    assert model.account_choices(None) == []


def test_accounts_error_message_flags_outdated_controller():
    from tesseract_desktop.api.errors import ApiError
    from tesseract_desktop.strings import CLAUDE

    assert model.sandbox_error_message(ApiError(404, "not_found", "nope"), "accounts_outdated") == CLAUDE["accounts_outdated"]


def test_client_account_routes(monkeypatch):
    calls = []

    def fake_request(self, method, path, body=None, **_kwargs):
        calls.append((method, path, body))
        return {"id": "app", "claudeAccountId": body["accountId"]} if "/projects/" in path else ACCOUNTS

    monkeypatch.setattr(ControllerClient, "request", fake_request)
    client = ControllerClient("http://127.0.0.1:1", "secret")
    assert client.claude_accounts() == ACCOUNTS
    assert client.set_default_claude_account("claude-work")["defaultAccountId"] == "claude-work"
    assert client.set_project_claude_account("my app", None)["claudeAccountId"] is None
    assert calls == [
        ("GET", "/v1/claude/accounts", None),
        ("PUT", "/v1/claude/accounts/default", {"accountId": "claude-work"}),
        ("PUT", "/v1/projects/my%20app/claude-account", {"accountId": None}),
    ]
