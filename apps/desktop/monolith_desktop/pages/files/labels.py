from types import MappingProxyType

TITLE = "Files"

FILES = MappingProxyType({
    "subtitle": "{count} across {projects}",
    "refresh": "Refresh",
    "list": "All files",
    "empty": "Build outputs and files Claude shares with theone-controller share show up here.",
    "no_match": "No files match these filters.",
    "loading": "Loading files…",
    "error_title": "Couldn't load files",
    "retry": "Try again",
    "dismiss": "Dismiss",
    "project_filter": "Filter by project",
    "source_filter": "Filter by source",
    "all_projects": "All projects",
    "all_sources": "All sources",
    "view": "Files view",
    "no_project": "No project",
    "empty_title": "No files yet",
})

VIEWS = MappingProxyType({
    "shared": "Shared files",
    "builds": "Project builds",
})

OUTPUTS = MappingProxyType({
    "list": "Project builds",
    "empty_title": "No builds found",
    "error_title": "Couldn't look for builds",
    "subtitle": "{count} across {projects}",
    "empty": "APKs, AABs, installers and AppImages in your projects' build, dist, release and out folders show up here.",
    "no_match": "No builds match this project.",
    "loading": "Looking for builds…",
    "missing": "{name} is no longer in the project. Rebuild it or refresh the list.",
})

SOURCES = MappingProxyType({
    "build": "Build",
    "agent": "Shared by Claude",
})

ARTIFACTS = MappingProxyType({
    "save": "Save…",
    "open": "Open download link",
    "send": "Send to device",
    "delete": "Delete",
    "sha": "sha256 {sha}",
    "saved": "Saved {name}",
    "downloading": "Downloading {name}",
    "failed": "Download failed: {error}",
    "missing": "{name} is no longer available in the sandbox.",
    "missing_unknown": "That file is no longer available in the sandbox.",
    "save_title": "Save file",
    "checksum": "The downloaded file does not match the artifact checksum, so it was discarded.",
})

DELETE = MappingProxyType({
    "title": "Delete {name}?",
    "body": "The file is removed from the sandbox. This can't be undone.",
    "confirm": "Delete",
    "cancel": "Cancel",
    "done": "Deleted {name}",
    "failed": "Couldn't delete {name}: {error}",
})

TAILDROP = MappingProxyType({
    "title": "Send {name}",
    "body": "Taildrop sends the file to a device on your tailnet.",
    "target": "Device",
    "confirm": "Send",
    "cancel": "Cancel",
    "no_targets": "No Taildrop devices are online.",
    "sending": "Sending {name} to {device}",
    "sent": "Sent {name} to {device}",
    "failed": "Couldn't send {name}: {error}",
})
