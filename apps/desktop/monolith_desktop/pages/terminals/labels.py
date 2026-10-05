from types import MappingProxyType

TITLE = "Terminals"

KINDS = MappingProxyType({"shell": "Shell", "claude": "Claude Code"})
KIND_ICONS = MappingProxyType({"shell": "terminal", "claude": "agents"})
WORKSPACE = "Workspace"

SIDEBAR = MappingProxyType({
    "title": "Sessions",
    "empty": "No sessions",
})

LAUNCH = MappingProxyType({
    "shell": "Shell",
    "claude": "Claude",
    "shell_tooltip": "Start a shell in the workspace",
    "claude_tooltip": "Start Claude Code in the workspace",
    "picker_tooltip": "Choose a project",
    "picker_title": "Start in",
    "loading_projects": "Loading projects…",
})

STATES = MappingProxyType({
    "connecting": "Connecting…",
    "open": "Live",
    "reconnecting": "Reconnecting…",
    "exited": "Exited",
    "exited_code": "Exited ({code})",
    "closed": "Disconnected",
    "detached": "Not attached",
    "running": "Running",
    "starting": "Starting…",
    "unavailable": "Unavailable",
})

META = MappingProxyType({
    "started": "started {when}",
    "size": "{cols}×{rows}",
})

ACTIONS = MappingProxyType({
    "restart": "Restart",
    "close": "Close session",
    "reconnect": "Reconnect",
    "remove": "Remove",
    "sessions": "Sessions",
    "more": "Terminal actions",
})

ROW_ACTIONS = MappingProxyType({
    "delete": "Delete session",
    "delete_running": "Terminate and delete session",
})

MENU = MappingProxyType({
    "copy": "Copy",
    "paste": "Paste",
    "select-all": "Select All",
    "zoom-in": "Larger Text",
    "zoom-out": "Smaller Text",
    "zoom-reset": "Reset Text Size",
    "clear": "Clear Scrollback",
})

BANNER = MappingProxyType({
    "exited_title": "Session ended",
    "exited": "The process exited with code {code}.",
    "exited_unknown": "The process exited.",
    "closed_title": "Disconnected",
    "closed": "The stream to this session closed. {error}",
    "reconnecting_title": "Connection lost",
    "reconnecting": "Trying to reattach; output is replayed once the stream is back.",
})

CONFIRM = MappingProxyType({
    "heading": "Delete this session?",
    "body": "{title} and everything running in it will be terminated.",
    "cancel": "Cancel",
    "close": "Terminate & Delete",
})

PLACEHOLDER = MappingProxyType({
    "title": "No session selected",
    "message": "Start a shell or a Claude Code session in the sandbox, or pick one from the list.",
    "shell": "New shell",
    "claude": "New Claude session",
})

EMPTY = MappingProxyType({
    "unconfigured": ("Connect to your sandbox", "Terminals run inside the sandbox. Connect to it first.", "Preferences"),
    "discovering": ("Looking for the sandbox…", None, None),
    "connecting": ("Connecting…", None, None),
    "offline": ("Sandbox unreachable", "{error}", "Retry"),
    "unauthorized": ("Token rejected", "The controller refused the saved token.", "Preferences"),
    "incompatible": ("Version mismatch", "{error}", "Preferences"),
})

ERRORS = MappingProxyType({
    "create": "Couldn't start the session: {error}",
    "close": "Couldn't close the session: {error}",
    "stream_unavailable": "Live terminal streams need libsoup 3.",
})
