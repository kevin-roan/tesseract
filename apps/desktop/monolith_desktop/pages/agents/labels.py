from types import MappingProxyType

TITLE = "Agents"
UNTITLED = "Untitled conversation"
NO_PROJECT = "Sandbox root"
NO_PROJECT_OPTION = "No project"

FILTERS = MappingProxyType({
    "all": "All",
    "running": "Running",
    "attention": "Needs attention",
    "archived": "Archived",
})

STATES = MappingProxyType({
    "running": "Running",
    "succeeded": "Done",
    "failed": "Failed",
    "cancelled": "Cancelled",
})

LIST = MappingProxyType({
    "search": "Search conversations",
    "new": "New conversation",
    "loading": "Loading conversations…",
    "empty_title": "No conversations yet",
    "empty_message": "Ask Claude to build, fix or explain something. Every run shows up here.",
    "no_match_title": "Nothing matches",
    "no_match_message": "Try another search or filter.",
    "attention": "Needs you",
    "terminals": "Claude in terminals",
    "terminal_active": "attached",
    "follow_up": "follow-up",
    "toggle": "Show conversations",
    "archived_empty_title": "Archive is empty",
    "archived_empty_message": "Archived conversations land here. Unarchive one to put it back in the list.",
})

MANAGE = MappingProxyType({
    "more": "Manage conversations",
    "noun": "conversation",
    "archive": "Archive",
    "unarchive": "Unarchive",
    "delete": "Delete…",
    "delete_tooltip": "Delete conversation",
    "archive_all": "Archive all finished",
    "delete_all": "Delete all finished…",
    "empty_archive": "Empty archive…",
    "archived": "Archived {count}",
    "unarchived": "Restored {count}",
    "deleted": "Deleted {count}",
    "undo": "Undo",
    "failed": "Couldn't update conversations: {error}",
    "load_failed": "Couldn't load archived conversations: {error}",
    "confirm_title": "Delete {count}?",
    "confirm_body": "{count} will be removed permanently. This can't be undone.",
    "confirm_yes": "Delete",
    "confirm_no": "Cancel",
})

ATTENTION = MappingProxyType({
    "open_run": "Open",
    "open_terminal": "Open terminal",
    "download": "Download",
    "mark_read": "Mark as read",
    "marked": "Marked as read",
    "failed": "Couldn't mark as read: {error}",
})

NEW = MappingProxyType({
    "title": "What should Claude do?",
    "subtitle": "Runs headless inside the sandbox. Pick a project so Claude works in its folder.",
    "placeholder": "Ask Claude to build, fix or explain…",
    "send": "Send",
    "hint": "Enter to send · Shift+Enter for a new line",
    "project": "Project",
    "failed": "Couldn't start Claude: {error}",
})

SUGGESTIONS = (
    ("Explain this project", "Explain how this project is structured and how to run it."),
    ("Fix failing tests", "Run the test suite, find the failing tests and fix them."),
    ("Review changes", "Review the uncommitted changes and point out bugs or risky edits."),
    ("Write a README", "Write a concise README with setup, scripts and project layout."),
    ("Build & report", "Build the project and report any errors with suggested fixes."),
)

CONVERSATION = MappingProxyType({
    "session": "Session {id}",
    "copy_session": "Copy session id",
    "copied": "Session id copied",
    "cancel": "Stop",
    "cancel_tooltip": "Stop this run",
    "open_terminal": "Open terminal",
    "download": "Download",
    "reload": "Reload",
    "loading": "Loading conversation…",
    "load_failed_title": "Couldn't load this conversation",
    "retry": "Try again",
    "dismiss": "Dismiss",
    "waiting": "Claude is thinking…",
    "jump": "Jump to latest",
    "continues": "Continues “{title}”",
    "follow_up_placeholder": "Reply to Claude…",
    "follow_up_running": "Claude is still working. You can reply when this run ends.",
    "follow_up_no_session": "This run has no Claude session to continue. Start a new conversation instead.",
    "follow_up_send": "Reply",
    "reconnecting": "Live output dropped. Reconnecting…",
    "polling": "Live output unavailable here; refreshing every few seconds.",
    "cancel_failed": "Couldn't stop the run: {error}",
    "cancel_confirm_title": "Stop Claude?",
    "cancel_confirm_body": "The run is cancelled. Work already written to the project stays.",
    "cancel_confirm_yes": "Stop run",
    "cancel_confirm_no": "Keep running",
    "tool_input": "Input",
    "tool_output": "Result",
    "result_done": "Finished",
    "result_failed": "Run failed",
    "result_cancelled": "Run cancelled",
    "copy_code": "Copy",
    "code_copied": "Copied to clipboard",
})
