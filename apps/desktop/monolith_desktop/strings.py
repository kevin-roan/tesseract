from types import MappingProxyType

SECTION_TITLES = MappingProxyType({"sandbox": "Sandbox", "host": "Host", "app": "App"})
SECTION_ORDER = ("sandbox", "host", "app")

MENU = MappingProxyType({
    "new_conversation": "New Conversation",
    "preferences": "Preferences",
    "rediscover": "Rediscover Sandbox",
    "about": "About Monolith",
    "quit": "Quit",
})

MAIN_MENU_TOOLTIP = "Main menu"
REFRESH_TOOLTIP = "Refresh"
ZOOM_TOAST = "Zoom {percent}%"

BANNER = MappingProxyType({
    "unconfigured": ("No sandbox is configured on this machine yet.", "Set Up"),
    "discovering": ("Looking for the sandbox on this machine…", None),
    "offline": ("Can't reach the sandbox: {error}", "Retry"),
    "unauthorized": ("The sandbox rejected the saved token.", "Fix Connection"),
    "incompatible": ("{error}", "Details"),
})

CONNECTION_LABELS = MappingProxyType({
    "unconfigured": "Not configured",
    "discovering": "Discovering…",
    "connecting": "Connecting…",
    "online": "Online",
    "offline": "Offline",
    "unauthorized": "Token rejected",
    "incompatible": "Incompatible",
})

EVENTS_LABELS = MappingProxyType({
    "idle": "Live updates off",
    "connecting": "Live updates connecting…",
    "open": "Live",
    "closed": "Live updates closed",
    "unavailable": "Live updates unavailable",
    "incompatible": "Live updates incompatible",
})

PREFERENCES = MappingProxyType({
    "connection_title": "Connection",
    "connection_icon": "network-server-symbolic",
    "sandbox_group": "Sandbox Controller",
    "sandbox_group_description": (
        "The desktop app talks to the controller REST API from this machine. "
        "Discovery asks Docker for the running sandbox and picks the first address that answers."
    ),
    "api_url": "API URL",
    "token": "Token",
    "name": "Display Name",
    "pairing_group": "Phone Pairing",
    "pairing_group_description": "The URL phones use. Leave empty to reuse the API URL.",
    "pairing_url": "Pairing URL",
    "status_group": "Connection Status",
    "status": "Status",
    "source": "Source",
    "save": "Save & Connect",
    "rediscover": "Rediscover",
    "forget": "Forget Saved Connection",
    "saved": "Connection saved",
    "discovered": "{message}",
    "discovery_failed": "Discovery failed: {error}",
    "invalid": "Enter a valid http(s) URL and a token",
    "config_file": "Config file: {path}",
})

SOURCE_LABELS = MappingProxyType({
    "file": "Saved config file",
    "env": "Environment variables",
    "docker": "Docker discovery",
    "manual": "Entered manually",
})

ABOUT = MappingProxyType({
    "developer": "Monolith",
    "comments": "Monitor and control the Monolith sandbox from the host, pair phones and keep an eye on this machine.",
})

WINDOW_CONTROLS = MappingProxyType({
    "minimize": "Minimize",
    "maximize": "Maximize",
    "restore": "Restore",
    "close": "Close",
})

SIDEBAR = MappingProxyType({
    "new_conversation": "New conversation",
    "new_conversation_shortcut": "Ctrl+N",
    "projects": "Projects",
    "new_project": "New project",
    "loading": "Loading projects…",
    "offline": "Connect to the sandbox to see your projects.",
    "empty": "No projects yet.",
    "create_project": "Create a project",
    "no_project": "No project",
    "no_runs": "No conversations yet",
    "running": "{count} running",
    "open_project": "Open {name}",
    "new_in_project": "New conversation in {name}",
    "expand": "Show conversations",
    "collapse": "Hide conversations",
    "untitled_run": "Untitled conversation",
    "more_runs": "All conversations",
})

COMPOSER = MappingProxyType({
    "placeholder": "Ask Claude…",
    "send": "Send (Ctrl+Enter)",
    "project_tooltip": "Project for the new conversation",
    "no_project": "No project",
    "offline": "Connect to the sandbox to start a conversation",
    "unavailable": "Conversations aren't available yet",
})

STATUS_FOOTER = MappingProxyType({
    "tooltip": "Connection settings",
    "fallback_title": "Sandbox",
    "separator": " · ",
})

CLAUDE = MappingProxyType({
    "title": "Claude",
    "icon": "dialog-password-symbolic",
    "host_group": "This Computer",
    "host_description": "Claude Code on this machine · {path}",
    "sandbox_group": "Sandbox",
    "sandbox_description": "Claude Code inside the sandbox uses this computer's ~/.claude folder (linked)",
    "refresh": "Refresh",
    "login": "Login",
    "account": "Account",
    "plan": "Plan",
    "token_expiry": "Access token",
    "settings": "Settings",
    "status": "Status",
    "logged_in": "Signed in",
    "not_logged_in": "Not signed in",
    "login_missing": "Login not found",
    "login_invalid": "Login file is unreadable",
    "login_keychain": "Login not found (macOS keychain not supported)",
    "expires_in": "Expires in {duration}",
    "expired": "Expired {duration} ago · Claude Code refreshes it on next use",
    "none": "—",
    "settings_none": "No settings found",
    "settings_json": "settings.json",
    "claude_md": "CLAUDE.md",
    "count_skills": "skill file",
    "count_agents": "agent file",
    "count_commands": "command file",
    "count_output-styles": "output style file",
    "unavailable": "Claude Code is not installed in the sandbox",
    "method_oauth_token": "Signed in with a long-lived token",
    "method_oauth_token_env": "Signed in with a long-lived token from the environment",
    "method_credentials": "Signed in with this computer's login",
    "method_api_key": "Using an API key",
    "method_none": "Not signed in",
    "settings_present": "settings.json present",
    "settings_missing": "No settings.json",
    "loading": "Loading…",
    "disconnected": "Not connected",
    "outdated": "This sandbox is too old for Claude sign-in. Rebuild and restart it: `bun run sandbox build` then `bun run sandbox up`.",
})

STT = MappingProxyType({
    "title": "Speech-to-text",
    "icon": "audio-input-microphone-symbolic",
    "profiles_group": "Resource Usage",
    "profiles_description": (
        "Voice notes are transcribed locally with whisper.cpp inside the sandbox. "
        "Pick how much of this computer it may use."
    ),
    "status_group": "Status",
    "refresh": "Refresh",
    "profile_off": "Off",
    "profile_eco": "Eco",
    "profile_balanced": "Balanced",
    "profile_performance": "Performance",
    "profile_off_description": "Voice notes are not transcribed",
    "profile_eco_description": "Lowest impact: base model, 2 threads, idle CPU and disk priority",
    "profile_balanced_description": "Faster: base model, a quarter of the CPU cores, low CPU priority",
    "profile_performance_description": "Most accurate: small model, half the CPU cores, normal priority",
    "thread": "thread",
    "nice": "nice {value}",
    "model_missing": "Model not installed in the sandbox",
    "engine": "Engine",
    "model": "Model",
    "state": "State",
    "activity": "Activity",
    "cpus": "CPU cores",
    "ready": "Ready",
    "not_ready": "Not ready",
    "idle": "Idle",
    "busy": "Transcribing",
    "queued": "{count} queued",
    "none": "—",
    "status": "Status",
    "loading": "Loading…",
    "disconnected": "Not connected",
    "changed": "Speech-to-text set to {profile}",
    "change_failed": "Couldn't change speech-to-text: {error}",
    "outdated": "This sandbox is too old for speech-to-text settings. Rebuild and restart it: `bun run sandbox build` then `bun run sandbox up`.",
})

SYNC_BACK = MappingProxyType({
    "pull_done": "Synced {project} to this computer",
    "pull_failed": "Couldn't sync {project} to this computer",
    "revert_done": "Reverted the last sync of {project}",
    "revert_failed": "Couldn't revert the last sync of {project}",
})
