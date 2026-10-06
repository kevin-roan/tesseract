from types import MappingProxyType

SECTION_TITLES = MappingProxyType({"sandbox": "Sandbox", "host": "Host", "app": "App"})
SECTION_ORDER = ("sandbox", "host", "app")

MENU = MappingProxyType({
    "new_conversation": "New Conversation",
    "preferences": "Preferences",
    "rediscover": "Rediscover Sandbox",
    "pair": "Pair a device…",
    "pair_host": "Pair this computer…",
    "about": "About Monolith",
    "quit": "Quit",
})

TRAY = MappingProxyType({
    "open": "Open Monolith",
    "hide": "Hide Window",
    "refresh": "Refresh",
    "pair": "Pair a device…",
    "pair_host": "Pair this computer…",
    "preferences": "Preferences",
    "quit": "Quit Monolith",
    "tooltip": "Monolith · {status}",
})

DIALOG = MappingProxyType({
    "close": "Close",
    "expand": "Expand",
    "copy": "Copy",
})

PAIR = MappingProxyType({
    "title": "Pair a device",
    "instructions": "Scan with the TheOne app, or open this link on the phone.",
    "sandbox": "Sandbox {name} · {url}",
    "copy": "Copy link",
    "copied": "Pairing link copied",
    "done": "Done",
    "secret": "The link contains the API token: share it only with your own devices.",
    "offline": "The sandbox is not answering right now. The phone can pair, but it will connect once the sandbox is back.",
    "unconfigured": "Connect to a sandbox before pairing a device.",
    "set_up": "Set up",
    "invalid": "Can't build a pairing link: {error}",
    "tab_sandbox": "Sandbox",
    "tab_host": "This computer",
    "host_instructions": "Scan with the TheOne app (Host shell), or open this link on the phone.",
    "host_caption": "Host {name} · {url}",
    "host_secret": "The link contains the host token: share it only with your own devices. Phones also need the PIN.",
    "host_loading": "Reading the host shell settings…",
    "host_stopped": "The host shell isn't running. Start it so the phone can reach this computer.",
    "host_starting": "Starting the host shell…",
    "host_external": "The host shell is running outside Monolith.",
    "host_failed": "The host shell couldn't start: {error}",
    "host_no_pin": "No PIN is set yet. Phones need it to unlock the shell.",
    "start": "Start",
    "set_pin": "Set PIN",
    "retry": "Retry",
})

HOST_SHELL = MappingProxyType({
    "title": "Host shell",
    "icon": "host",
    "server_group": "Server",
    "server_description": (
        "Lets paired phones open a terminal on this computer over Tailscale. "
        "Monolith runs it in the background and stops it when you quit."
    ),
    "serve": "Serve host shell",
    "autostart": "Start with Monolith",
    "autostart_subtitle": "Start serving whenever Monolith opens",
    "status_stopped": "Stopped",
    "status_starting": "Starting…",
    "status_running": "Running · {url}",
    "status_running_plain": "Running",
    "status_stopping": "Stopping…",
    "status_external": "Running outside Monolith · {url}",
    "status_failed": "Failed: {error}",
    "security_group": "Security",
    "pin": "PIN",
    "pin_set": "Set · phones unlock with it",
    "pin_missing": "Not set · phones can't unlock the shell",
    "set_pin": "Set PIN…",
    "change_pin": "Change…",
    "token": "Host token",
    "token_subtitle": "Paired phones use it to reach this computer",
    "rotate": "Rotate…",
    "rotate_heading": "Rotate the host token?",
    "rotate_body": "Every paired phone stops working until you pair it again.",
    "rotate_confirm": "Rotate",
    "rotated": "Host token rotated; pair your phones again",
    "rotate_failed": "Couldn't rotate the token: {error}",
    "pair_group": "Pairing",
    "pair": "Pair a phone",
    "pair_subtitle": "Show the theone://host link and QR code",
    "pair_button": "Show QR…",
    "log": "Log",
    "log_empty": "No output yet",
    "refresh": "Refresh",
    "cancel": "Cancel",
})

HOST_PIN = MappingProxyType({
    "title": "Host shell PIN",
    "context": "This computer",
    "subtitle": "6 to 12 digits",
    "pin": "New PIN",
    "repeat": "Repeat PIN",
    "save": "Save PIN",
    "cancel": "Cancel",
    "description": "Saving a new PIN ends every open phone session.",
    "invalid": "The PIN must be 6 to 12 digits",
    "mismatch": "The PINs do not match",
    "saved": "Host shell PIN saved",
    "failed": "Couldn't save the PIN: {error}",
})

HOST_UNLOCK = MappingProxyType({
    "title": "Unlock the host shell",
    "context": "This computer",
    "subtitle": "Enter the host shell PIN to start the Android emulator",
    "pin": "PIN",
    "unlock": "Unlock",
    "cancel": "Cancel",
    "invalid": "The PIN must be 6 to 12 digits",
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
    "dialog_title": "Settings",
    "connection_title": "Connection",
    "connection_icon": "connection",
    "sandbox_group": "Sandbox controller",
    "sandbox_group_description": (
        "The desktop app talks to the controller REST API from this machine. "
        "Discovery asks Docker for the running sandbox and picks the first address that answers."
    ),
    "api_url": "API URL",
    "token": "Token",
    "name": "Display name",
    "pairing_group": "Phone pairing",
    "pairing_group_description": "The URL phones use. Leave empty to reuse the API URL.",
    "pairing_url": "Pairing URL",
    "status_group": "Connection status",
    "status": "Status",
    "source": "Source",
    "save": "Save & connect",
    "rediscover": "Rediscover",
    "forget": "Forget saved connection",
    "forget_subtitle": "Removes the saved URL and token from this computer",
    "forget_button": "Forget",
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
    "new_conversation_tooltip": "New conversation (Ctrl+N)",
    "search": "Search conversations",
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
    "confidential": "Confidential",
})

COMPOSER = MappingProxyType({
    "placeholder": "Ask Claude…",
    "send": "Send (Ctrl+Enter)",
    "project_tooltip": "Project for the new conversation",
    "no_project": "No project",
    "offline": "Connect to the sandbox to start a conversation",
    "unavailable": "Conversations aren't available yet",
})

ATTACHMENTS = MappingProxyType({
    "attach": "Attach",
    "files": "Files…",
    "images": "Images…",
    "paste": "Paste image",
    "files_title": "Attach files",
    "images_title": "Attach images",
    "images_filter": "Images",
    "remove": "Remove {name}",
    "retry": "Retry {name}",
    "too_large": "{name} is larger than {limit}.",
    "too_many": "You can attach up to {limit} files to one message.",
    "no_path": "{name} isn't a local file, so it can't be attached.",
    "unreadable": "Couldn't read {name}: {error}",
    "empty_clipboard": "There's no image on the clipboard to paste.",
    "prompt_image": "Take a look at this image.",
    "prompt_images": "Take a look at these images.",
    "prompt_file": "Take a look at the attached file.",
    "prompt_files": "Take a look at the attached files.",
})

STATUS_FOOTER = MappingProxyType({
    "tooltip": "Connection settings",
    "fallback_title": "Sandbox",
    "separator": " · ",
})

CLAUDE = MappingProxyType({
    "title": "Claude",
    "icon": "agents",
    "host_group": "This computer",
    "host_description": "Claude Code accounts on this machine (~/.claude and ~/.claude-<name>)",
    "sandbox_group": "Sandbox",
    "sandbox_description": "Claude Code inside the sandbox uses this computer's ~/.claude folders (linked)",
    "accounts_group": "Accounts",
    "accounts_description": "Accounts linked into the sandbox. The default is used by projects that don't pick one.",
    "primary": "primary",
    "account_absent": "Not linked into the sandbox",
    "default_changed": "Default Claude account set to {id}",
    "default_change_failed": "Couldn't change the default Claude account: {error}",
    "accounts_empty": "No accounts",
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
    "accounts_outdated": "This sandbox is too old for multiple Claude accounts. Rebuild and restart it: `bun run sandbox build` then `bun run sandbox up`.",
    "outdated": "This sandbox is too old for Claude sign-in. Rebuild and restart it: `bun run sandbox build` then `bun run sandbox up`.",
})

APPEARANCE = MappingProxyType({
    "title": "Appearance",
    "icon": "appearance",
    "theme_group": "Theme",
    "theme_description": "Choose how Monolith looks on this computer.",
    "system": "System",
    "system_subtitle": "Follow the light or dark setting of your desktop",
    "light": "Light",
    "light_subtitle": "Light panels with dark text",
    "dark": "Dark",
    "dark_subtitle": "Dark panels with light text",
})

STT = MappingProxyType({
    "title": "Speech-to-text",
    "icon": "microphone",
    "profiles_group": "Resource usage",
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
    "gemini_group": "Gemini",
    "gemini_description": (
        "Cloud transcription for voice notes sent with the Gemini provider. "
        "The key is stored on the sandbox and shared with the mobile app."
    ),
    "gemini_key": "API key",
    "gemini_source_settings": "Saved from an app",
    "gemini_source_env": "GEMINI_API_KEY on the sandbox",
    "gemini_source_none": "Not set",
    "gemini_remove": "Remove saved key",
    "save": "Save",
    "gemini_saved": "Gemini API key saved",
    "gemini_removed": "Gemini API key removed",
    "gemini_failed": "Couldn't update the Gemini API key: {error}",
    "outdated": "This sandbox is too old for speech-to-text settings. Rebuild and restart it: `bun run sandbox build` then `bun run sandbox up`.",
})

SYNC_BACK = MappingProxyType({
    "pull_done": "Synced {project} to this computer",
    "pull_failed": "Couldn't sync {project} to this computer",
    "revert_done": "Reverted the last sync of {project}",
    "revert_failed": "Couldn't revert the last sync of {project}",
    "get_done": "Sent {project} changes to the sandbox",
    "get_failed": "Couldn't send {project} changes to the sandbox",
})
