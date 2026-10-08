"""Read the host's Claude Code state for display. The sandbox links this computer's ~/.claude and ~/.claude-<name> directly.

Nothing here returns or logs a secret.
"""

import json
import os
import re
import sys
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

CLAUDE_EXTENSION_DIRS: tuple[str, ...] = ("skills", "agents", "commands", "output-styles")

CREDENTIALS_FILE = ".credentials.json"
CREDENTIALS_KEY = "claudeAiOauth"
GLOBAL_CONFIG_FILE = ".claude.json"
CONFIG_DIR_ENV = "CLAUDE_CONFIG_DIR"
PRIMARY_ACCOUNT_ID = "claude"
ACCOUNT_DIR_PATTERN = re.compile(r"^\.claude-([a-z0-9][a-z0-9_-]{0,31})$")
IGNORED_DIRS = frozenset({".git", ".hg", ".svn", "node_modules", "__pycache__"})

LoginIssue = Literal["missing", "invalid", "keychain"]


@dataclass(frozen=True)
class HostPaths:
    config_dir: Path
    global_config: Path


@dataclass(frozen=True)
class HostAccount:
    id: str
    paths: HostPaths


@dataclass(frozen=True)
class HostClaudeState:
    config_dir: Path
    logged_in: bool
    login_issue: LoginIssue | None
    email: str | None
    display_name: str | None
    organization: str | None
    subscription_type: str | None
    expires_at: float | None
    settings_present: bool
    claude_md_present: bool
    extension_counts: Mapping[str, int] = field(default_factory=dict)
    account_id: str = PRIMARY_ACCOUNT_ID


def host_paths(env: Mapping[str, str] | None = None, home: Path | None = None) -> HostPaths:
    env = os.environ if env is None else env
    home = home or Path.home()
    custom = env.get(CONFIG_DIR_ENV)
    if custom:
        config_dir = Path(custom).expanduser()
        return HostPaths(config_dir, config_dir / GLOBAL_CONFIG_FILE)
    return HostPaths(home / ".claude", home / GLOBAL_CONFIG_FILE)


def host_accounts(env: Mapping[str, str] | None = None, home: Path | None = None) -> list[HostAccount]:
    """The primary config dir, then every `~/.claude-<name>` holding a login (the `claude-<name>` aliases)."""
    home = home or Path.home()
    primary = host_paths(env, home)
    accounts = [HostAccount(PRIMARY_ACCOUNT_ID, primary)]
    try:
        entries = sorted(home.iterdir())
    except OSError:
        return accounts
    for entry in entries:
        match = ACCOUNT_DIR_PATTERN.match(entry.name)
        if match and entry != primary.config_dir and entry.is_dir() and (entry / CREDENTIALS_FILE).is_file():
            accounts.append(HostAccount(f"{PRIMARY_ACCOUNT_ID}-{match[1]}", HostPaths(entry, entry / GLOBAL_CONFIG_FILE)))
    return accounts


def _read_json(path: Path) -> dict[str, Any] | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _str(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def read_login(paths: HostPaths, platform: str = sys.platform) -> tuple[dict[str, Any] | None, LoginIssue | None]:
    if platform == "darwin":
        return None, "keychain"
    path = paths.config_dir / CREDENTIALS_FILE
    if not path.is_file():
        return None, "missing"
    data = _read_json(path)
    oauth = data.get(CREDENTIALS_KEY) if data else None
    if not isinstance(oauth, dict) or not _str(oauth.get("accessToken")):
        return None, "invalid"
    return oauth, None


def read_oauth_account(paths: HostPaths) -> dict[str, Any]:
    account = (_read_json(paths.global_config) or {}).get("oauthAccount")
    return account if isinstance(account, dict) else {}


def _is_regular(path: Path) -> bool:
    return not path.is_symlink() and path.is_file()


def _walk(root: Path) -> list[Path]:
    found: list[Path] = []
    if root.is_symlink() or not root.is_dir():
        return found
    for current, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in IGNORED_DIRS)
        found.extend(Path(current) / name for name in sorted(files))
    return found


def read_host_state(
    paths: HostPaths | None = None, platform: str = sys.platform, account_id: str = PRIMARY_ACCOUNT_ID
) -> HostClaudeState:
    paths = paths or host_paths()
    oauth, issue = read_login(paths, platform)
    oauth_account = read_oauth_account(paths)
    expires = oauth.get("expiresAt") if oauth else None
    counts = {
        name: sum(1 for path in _walk(paths.config_dir / name) if _is_regular(path)) for name in CLAUDE_EXTENSION_DIRS
    }
    return HostClaudeState(
        config_dir=paths.config_dir,
        logged_in=oauth is not None,
        login_issue=issue,
        email=_str(oauth_account.get("emailAddress")),
        display_name=_str(oauth_account.get("displayName")),
        organization=_str(oauth_account.get("organizationName")),
        subscription_type=_str(oauth.get("subscriptionType")) if oauth else None,
        expires_at=expires / 1000 if isinstance(expires, int | float) and not isinstance(expires, bool) else None,
        settings_present=_is_regular(paths.config_dir / "settings.json"),
        claude_md_present=_is_regular(paths.config_dir / "CLAUDE.md"),
        extension_counts=counts,
        account_id=account_id,
    )


def read_host_states(
    env: Mapping[str, str] | None = None, home: Path | None = None, platform: str = sys.platform
) -> list[HostClaudeState]:
    return [read_host_state(account.paths, platform, account.id) for account in host_accounts(env, home)]
