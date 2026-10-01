from types import MappingProxyType

TITLE = "Projects"
PROJECTS_ROOT = "/workspace/projects"
DEFAULT_PACKAGE_MANAGER = "npm"

LIST = MappingProxyType({
    "subtitle": "{count} in {root}",
    "search": "Search projects",
    "new": "New project",
    "refresh": "Refresh",
    "no_match_title": "No matching projects",
    "no_match": "Nothing matches “{query}”.",
    "clear_search": "Clear search",
    "ask": "Ask Claude about {name}",
    "loading": "Loading projects…",
})

EMPTY = MappingProxyType({
    "title": "No projects yet",
    "message": "Clone a repository or start an empty project in /workspace/projects, or ask Claude to set one up.",
    "action": "New project",
    "secondary": "Ask Claude",
})

CONNECTION = MappingProxyType({
    "unconfigured": ("Connect to your sandbox", "Projects live inside the sandbox. Set up the connection first.", "Preferences", "preferences"),
    "discovering": ("Looking for the sandbox…", None, None, None),
    "connecting": ("Connecting…", None, None, None),
    "offline": ("Sandbox unreachable", "{error}", "Retry", "retry"),
    "unauthorized": ("Token rejected", "The controller refused the saved token.", "Preferences", "preferences"),
    "incompatible": ("Version mismatch", "{error}", "Preferences", "preferences"),
})

ACTIVITY = MappingProxyType({
    "agent": "Claude working",
    "building": "Building",
    "running": "{count} running",
    "idle": "Idle",
})

GIT = MappingProxyType({
    "none": "Not a git repository",
    "detached": "detached",
    "ahead": "↑{count}",
    "behind": "↓{count}",
    "dirty": "Uncommitted changes",
    "clean": "Clean",
    "changes": "{count} changed",
    "no_commits": "No commits yet",
    "files": "Working tree",
    "files_empty": "Nothing to commit, working tree clean.",
    "log": "Recent commits",
    "log_empty": "No commits yet.",
    "branch": "Branch",
    "upstream": "Upstream",
    "status": "Status",
    "in_sync": "In sync",
    "error": "Couldn't read git status: {error}",
})

FRAMEWORKS = MappingProxyType({
    "expo": "Expo",
    "react-native": "React Native",
    "electron": "Electron",
    "vite": "Vite",
    "next": "Next.js",
    "node": "Node",
    "android": "Android",
    "python": "Python",
    "unknown": "Project",
})

BUILD_TARGETS = MappingProxyType({
    "electron-linux": ("Linux AppImage", "Electron"),
    "electron-windows": ("Windows installer", "Electron + wine"),
    "android-apk": ("Android APK", "Gradle"),
    "web": ("Web bundle", "Static files"),
    "script": ("Build script", "Logs only"),
})

BUILD_PROFILES = MappingProxyType({"debug": "Debug", "release": "Release"})

PROCESS_STATES = MappingProxyType({
    "starting": "Starting",
    "running": "Running",
    "exited": "Exited",
    "failed": "Failed",
    "stopped": "Stopped",
    "orphaned": "Orphaned",
})

BUILD_STATES = MappingProxyType({
    "queued": "Queued",
    "running": "Running",
    "succeeded": "Succeeded",
    "failed": "Failed",
    "cancelled": "Cancelled",
})

RUN_STATES = MappingProxyType({
    "running": "Working",
    "succeeded": "Done",
    "failed": "Failed",
    "cancelled": "Cancelled",
})

DETAIL = MappingProxyType({
    "loading": "Loading project…",
    "error_title": "Couldn't load this project",
    "retry": "Try again",
    "refresh": "Refresh",
    "ask": "Ask Claude",
    "claude_terminal": "Claude terminal",
    "shell": "Shell",
    "display": "Display",
    "copy_path": "Copy path",
    "copied": "Path copied",
    "dismiss": "Dismiss",
})

TABS = MappingProxyType({
    "git": "Git",
    "sync": "Sync back",
    "processes": "Processes",
    "builds": "Builds",
    "artifacts": "Artifacts",
    "conversations": "Conversations",
})

PROCESSES = MappingProxyType({
    "sites": "Listening ports",
    "sites_subtitle": "Servers started from this project",
    "open": "Open in browser",
    "copy": "Copy URL",
    "copied": "URL copied",
    "no_url": "No address reachable from this machine",
    "port": ":{port}",
    "scripts": "Scripts",
    "scripts_subtitle": "Package scripts run with {pm}",
    "run": "Run",
    "run_display": "Run on display",
    "list": "Processes",
    "list_empty": "Nothing has run in this project yet.",
    "new": "Run command",
    "stop": "Stop",
    "logs": "Show logs",
    "hide_logs": "Hide logs",
    "meta_running": "started {when}",
    "meta_ended": "ran {duration} · ended {when}",
    "exit": "exit {code}",
    "pid": "pid {pid}",
    "display": "display",
    "logs_title": "Logs · {name}",
    "stop_title": "Stop {name}?",
    "stop_body": "The process gets SIGTERM, then SIGKILL after 5 seconds.",
    "stop_confirm": "Stop",
    "cancel": "Cancel",
    "stopped": "Stopped {name}",
    "started": "Started {name}",
})

BUILDS = MappingProxyType({
    "targets": "Build targets",
    "targets_subtitle": "Detected from the project's package.json and native folders",
    "targets_empty": "No build targets detected for this project.",
    "build": "Build",
    "jobs": "Builds",
    "jobs_empty": "No builds yet.",
    "cancel": "Cancel build",
    "logs": "Show logs",
    "hide_logs": "Hide logs",
    "meta": "{profile} · {when}",
    "stage": "{stage}",
    "artifacts": "{count} artifacts",
    "logs_title": "Logs · {target}",
    "cancel_title": "Cancel this build?",
    "cancel_body": "{target} ({profile}) stops and its outputs are discarded.",
    "cancel_confirm": "Cancel Build",
    "keep": "Keep Building",
    "started": "Building {target}",
})

ARTIFACTS = MappingProxyType({
    "list": "Artifacts",
    "list_empty": "No artifacts yet. Successful builds and files Claude shares put their outputs here.",
})

CONVERSATIONS = MappingProxyType({
    "list": "Claude runs",
    "list_empty": "No Claude runs for this project yet.",
    "new": "New conversation",
    "open": "Open conversation",
})

LOGS = MappingProxyType({
    "empty": "Waiting for output…",
    "jump": "Jump to latest output",
    "connecting": "Connecting",
    "live": "Live",
    "ended": "Ended",
    "exit": "Exited {code}",
    "killed": "Stopped",
    "unavailable": "Live logs unavailable: showing a snapshot",
    "close": "Close logs",
})

CREATE = MappingProxyType({
    "title": "New project",
    "subtitle": "Start an empty folder or clone a repository into the sandbox.",
    "name": "Name",
    "git_url": "Git URL (optional)",
    "branch": "Branch (optional)",
    "details": "Project",
    "source": "Clone from",
    "source_hint": "Leave empty to create an empty project.",
    "create": "Create",
    "clone": "Clone",
    "cancel": "Cancel",
    "close": "Close",
    "open": "Open project",
    "open_anyway": "Open anyway",
    "location": "Created as {root}/{id}",
    "location_empty": "Becomes a folder in {root}.",
    "cloning": "Cloning",
    "cloned": "Cloned",
    "failed": "Failed",
    "cloning_title": "Cloning {name}",
    "clone_done": "The repository is ready.",
    "clone_failed_code": "git exited with code {code}.",
    "clone_failed_signal": "git stopped before it finished.",
    "clone_failed_hint": "The project folder stays in place, so you can open it and retry from a shell.",
    "background": "Cloning continues in the background.",
    "created": "Created {name}",
    "conflict": "{root}/{id} already exists.",
})

VALIDATION = MappingProxyType({
    "name_required": "Enter a project name.",
    "name_too_long": "Keep the name under {max} characters.",
    "name_invalid": "Use at least one letter or digit.",
    "name_exists": "{root}/{id} already exists.",
    "git_url": "Use an https://, ssh://, git://, file:// or user@host:path URL.",
    "branch_needs_url": "A branch only applies when cloning. Add a git URL or clear it.",
    "branch_invalid": "That is not a valid branch name.",
    "command_required": "Enter a command to run.",
    "command_too_long": "Keep the command under {max} characters.",
    "port_invalid": "Use a port between 1 and 65535.",
})

RUN_DIALOG = MappingProxyType({
    "title": "Run a command",
    "subtitle": "Runs with bash -lc in {path}",
    "name": "Name (optional)",
    "command": "Command",
    "port": "Port (optional)",
    "display": "Show on the sandbox display",
    "display_subtitle": "Sets DISPLAY so GUI apps appear in the VNC view",
    "start": "Run",
    "cancel": "Cancel",
    "conflict": "Port {port} is taken: {message}",
})

SYNC = MappingProxyType({
    "not_linked": "Not linked on this computer. Run monolith --sync in the project's checkout to link it, then changes made in the sandbox can be synced back.",
    "never_pushed": "The sandbox has no push baseline yet. Run monolith --sync in {path}.",
    "error": "Couldn't read sandbox changes: {error}",
    "host_path": "Host folder",
    "pushed": "Linked",
    "baseline": "Sandbox baseline",
    "changes": "Sandbox changes",
    "changes_subtitle": "{count} · {size}",
    "changes_empty": "Nothing to sync. The host folder matches the sandbox.",
    "conflict": "changed on the host since the push",
    "conflict_badge": "Host edit",
    "sync": "Sync to host",
    "syncing": "Syncing…",
    "revert": "Revert last sync",
    "snapshots": "Snapshots",
    "snapshots_subtitle": "Taken before every sync to host; the newest 20 are kept",
    "snapshots_empty": "No syncs yet.",
    "snapshot_meta": "{files} · {when}",
    "reverted": "Reverted",
    "requests": "Recent requests",
    "requests_empty": "No sync requests yet.",
    "request_meta": "from {source} · {when}",
    "confirm_title": "Sync {count} to {path}?",
    "confirm_body": "A snapshot is taken first, so you can undo this with Revert last sync.\n\n{files}",
    "confirm_conflicts": "{count} of them changed on this computer since the push and will be overwritten.\n\n",
    "confirm": "Sync",
    "confirm_force": "Overwrite and Sync",
    "cancel": "Cancel",
    "revert_title": "Revert snapshot {id}?",
    "revert_body": "Puts back the {count} as they were before that sync. The sandbox is not changed.",
    "revert_confirm": "Revert",
    "more": "… and {count} more",
    "queued": "Sync requested",
})

SYNC_STATES = MappingProxyType({
    "pending": ("Waiting", "info"),
    "claimed": ("Applying", "info"),
    "applied": ("Applied", "success"),
    "failed": ("Failed", "danger"),
    "cancelled": ("Cancelled", "neutral"),
})

SYNC_KINDS = MappingProxyType({"pull": "Sync to host", "revert": "Revert"})

SYNC_CODES = MappingProxyType({"added": ("A", "success"), "modified": ("M", "warning"), "deleted": ("D", "danger")})
