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
    "no_tab": "No {tab} projects",
    "clear_search": "Clear search",
    "ask": "Ask Claude about {name}",
    "loading": "Loading projects…",
    "tabs": "Project filter",
    "search_toggle": "Search projects",
    "group_toggle": "Group by status",
})

LIST_TABS = MappingProxyType({
    "all": "All projects",
    "active": "Active",
    "idle": "Idle",
})

GROUPS = MappingProxyType({
    "agent": "Claude working",
    "building": "Building",
    "running": "Running",
    "idle": "Idle",
    "all": "Projects",
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
    "flutter": "Flutter",
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
    "rename": "Rename",
    "delete": "Delete from sandbox",
    "copy_path": "Copy path",
    "copied": "Path copied",
    "dismiss": "Dismiss",
    "tabs": "Project sections",
})

EMULATOR = MappingProxyType({
    "run": "Run on emulator",
    "show": "Show emulator",
    "tooltip": "Build the app and install it on the host Android emulator",
    "tooltip_dir": "Build the app in {dir} and install it on the host Android emulator",
    "unavailable": "Can't run on the emulator: {reason}",
    "started": "Building for the emulator; the app opens there when the build finishes",
    "failed": "Couldn't run on the emulator: {error}",
    "no_serial": "The emulator is not reachable from this machine",
    "no_scrcpy": "The app runs on the emulator; install scrcpy to see its screen here",
    "viewer_failed": "Couldn't show the emulator: {error}",
    "title": "{name} · Android emulator",
})

CLAUDE_ACCOUNT = MappingProxyType({
    "tooltip": "Claude account for this project",
    "default": "Default ({id})",
    "badge": "Claude · {id}",
    "changed": "{project} now uses the {account} Claude account",
    "change_failed": "Couldn't change the Claude account: {error}",
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
    "list_empty": "Successful builds and files Claude shares put their outputs here.",
    "empty_title": "No artifacts yet",
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
    "source_hint_confidential": "Leave empty to create an empty project. The sandbox still receives the git URL to clone it.",
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
    "confidential": "Confidential",
    "confidential_hint": "The real name stays on this computer and the sandbox only sees a pseudonym. Claude won't share artifacts and redacts names, URLs and authors.",
    "reroll": "New pseudonym",
})

RENAME = MappingProxyType({
    "title": "Rename project",
    "subtitle": "{root}/{id}",
    "name": "Name",
    "group": "Display name",
    "hint": "Only the name shown in the apps changes, not the folder. Leave it empty to use the detected name.",
    "save": "Save",
    "cancel": "Cancel",
    "renamed": "Renamed to {name}",
    "reset": "{id} uses its detected name again",
})

REMOVE = MappingProxyType({
    "title": "Delete {name}?",
    "body": "It moves to /tmp in the sandbox. The project on {host} is not touched.",
    "only_copy_title": "Only copy of this project",
    "only_copy_body": "{name} was never synced from a computer, so the sandbox has its only copy. Deleting moves it to /tmp in the sandbox.",
    "unsynced_title": "Unsynced changes",
    "unsynced_body": "{files} in {name} changed in the sandbox and {verb} not synced back to {host}: {paths}.\n\n"
                     "Sync to host first to keep them there, or force delete: the sandbox copy moves to /tmp and the project on {host} stays as it was.",
    "more": "{paths} and {extra} more",
    "host": "your computer",
    "delete": "Delete",
    "force": "Force delete",
    "cancel": "Cancel",
    "deleted": "Deleted {name} from the sandbox",
    "failed": "Couldn't delete {name}: {error}",
})

CONFIDENTIAL = MappingProxyType({
    "badge": "Confidential",
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
    "got": "Last get",
    "baseline": "Sandbox baseline",
    "changes": "Sandbox changes",
    "changes_subtitle": "{count} · {size}",
    "changes_empty": "Nothing to sync. The host folder matches the sandbox.",
    "conflict": "changed on the host since the push",
    "conflict_badge": "Host edit",
    "sync": "Sync to host",
    "syncing": "Syncing…",
    "get": "Sync from host",
    "revert": "Revert last sync",
    "discard": "Discard changes",
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
    "get_title": "Sync from {path}?",
    "get_body": "Copies what changed in {path} since the last push or sync into the sandbox.",
    "get_conflicts": "The last sync from this computer stopped because the sandbox also edited {count}. Syncing again overwrites them; copies of the sandbox versions are kept on the sandbox.\n\n{files}",
    "get_confirm": "Sync",
    "get_force": "Overwrite and Sync",
    "discard_title": "Discard {count} in the sandbox?",
    "discard_body": "Puts these files back as they were at the last sync. Added files are deleted. The host folder is not changed.\n\n{files}",
    "discard_skipped": "\n\n{count} can't be restored by the sandbox and stay as they are.",
    "discard_confirm": "Discard",
    "discarded": "Discarded {count} in the sandbox",
    "discarded_none": "Nothing was discarded",
    "discard_unavailable": "{count} kept, the sandbox has no copy of the synced version: {files}",
    "discard_backup": "Previous versions saved in {path}",
    "discard_failed": "Couldn't discard the sandbox changes: {error}",
    "dismiss": "Dismiss",
    "more": "… and {count} more",
    "queued_pull": "Sync requested",
    "queued_get": "Sync from host requested",
    "queued_revert": "Revert requested",
})

SYNC_HINTS = MappingProxyType({
    "pull": "Copy the sandbox changes into the host folder",
    "get": "Copy the host folder's changes into the sandbox",
    "revert": "Undo the last sync to host on this computer",
    "discard": "Throw away the sandbox changes and restore the synced versions",
})

SYNC_BLOCKED = MappingProxyType({
    "loading": "Loading the sandbox changes…",
    "unavailable": "The sandbox changes couldn't be read",
    "not_linked": "Not linked on this computer. Run monolith --sync in the checkout first",
    "never_pushed": "Never pushed. Run monolith --sync in the checkout first",
    "active": "A sync request is already in progress",
    "nothing_to_sync": "Nothing to sync. The host folder matches the sandbox",
    "nothing_to_discard": "Nothing to discard. The sandbox matches the last sync",
    "not_discardable": "The sandbox has no copy of the synced versions of these files",
    "no_snapshot": "No sync to revert",
})

SYNC_STATES = MappingProxyType({
    "pending": ("Waiting", "info"),
    "claimed": ("Applying", "info"),
    "applied": ("Applied", "success"),
    "failed": ("Failed", "danger"),
    "cancelled": ("Cancelled", "neutral"),
})

SYNC_KINDS = MappingProxyType({"pull": "Sync to host", "revert": "Revert", "get": "Sync from host"})

SYNC_CODES = MappingProxyType({"added": ("A", "success"), "modified": ("M", "warning"), "deleted": ("D", "danger")})
