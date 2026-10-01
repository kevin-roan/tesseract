from ..api.errors import ApiError, describe_error
from ..api.types import ClaudeAuthStatus
from ..strings import CLAUDE as S
from ..util.format import capitalize, format_uptime, join_meta, now_s, parse_iso, pluralize
from .host import CLAUDE_EXTENSION_DIRS, HostClaudeState

Row = tuple[str, str]


def sandbox_error_message(error: BaseException | None) -> str:
    """A 404 on the Claude routes means the controller predates them."""
    if isinstance(error, ApiError) and error.status == 404:
        return S["outdated"]
    return describe_error(error)


def plan_label(value: str | None) -> str:
    return capitalize(value) if value else S["none"]


def format_expiry(expires_at: float | None, now: float | None = None) -> str:
    if expires_at is None:
        return S["none"]
    delta = expires_at - (now if now is not None else now_s())
    if delta >= 0:
        return S["expires_in"].format(duration=format_uptime(max(60.0, delta)))
    return S["expired"].format(duration=format_uptime(max(60.0, -delta)))


def settings_summary(state: HostClaudeState) -> str:
    parts = [S["settings_json"] if state.settings_present else None, S["claude_md"] if state.claude_md_present else None]
    parts.extend(
        pluralize(state.extension_counts[name], S[f"count_{name}"])
        for name in CLAUDE_EXTENSION_DIRS
        if state.extension_counts.get(name)
    )
    return join_meta(*parts) or S["settings_none"]


def login_label(state: HostClaudeState) -> str:
    if state.logged_in:
        return S["logged_in"]
    return S[f"login_{state.login_issue or 'missing'}"]


def account_label(email: str | None, organization: str | None) -> str:
    return join_meta(email, organization) or S["none"]


def host_rows(state: HostClaudeState, now: float | None = None) -> list[Row]:
    return [
        (S["login"], login_label(state)),
        (S["account"], account_label(state.email, state.organization)),
        (S["plan"], plan_label(state.subscription_type)),
        (S["token_expiry"], format_expiry(state.expires_at, now) if state.logged_in else S["none"]),
        (S["settings"], settings_summary(state)),
    ]


def method_label(status: ClaudeAuthStatus) -> str:
    if not status["available"]:
        return S["unavailable"]
    if status["method"] == "oauth_token" and status["oauthTokenFromEnv"]:
        return S["method_oauth_token_env"]
    return S[f"method_{status['method']}"]


def sandbox_rows(status: ClaudeAuthStatus, now: float | None = None) -> list[Row]:
    account = status["account"] or {"email": None, "organization": None}
    expiry = S["none"]
    if status["method"] == "credentials" and status["credentialsExpiresAt"]:
        expiry = format_expiry(parse_iso(status["credentialsExpiresAt"]), now)
    return [
        (S["status"], method_label(status)),
        (S["account"], account_label(account.get("email"), account.get("organization"))),
        (S["plan"], plan_label(status["subscriptionType"])),
        (S["token_expiry"], expiry),
        (S["settings"], S["settings_present"] if status["settingsPresent"] else S["settings_missing"]),
    ]
