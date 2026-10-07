export const AGENTS_LABELS = {
  title: "Agents",
  untitled: "Untitled conversation",
  noProject: "Sandbox root",
  noProjectOption: "No project",
} as const;

export const FILTER_LABELS = {
  all: "All",
  running: "Running",
  attention: "Needs attention",
  archived: "Archived",
} as const;

export const STATE_LABELS = {
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
} as const;

export const LIST_LABELS = {
  search: "Search conversations",
  searchToggle: "Search",
  filter: "Filter",
  clearFilter: "Clear filter",
  new: "New conversation",
  loading: "Loading conversations…",
  emptyTitle: "No conversations yet",
  emptyMessage: "Ask Claude to build, fix or explain something. Every run shows up here.",
  noMatchTitle: "Nothing matches",
  noMatchMessage: "Try another search or filter.",
  attention: "Needs you",
  terminals: "Claude in terminals",
  terminalActive: "attached",
  followUp: "follow-up",
  toggle: "Show conversations",
  conversations: "Conversations",
  archivedEmptyTitle: "Archive is empty",
  archivedEmptyMessage: "Archived conversations land here. Unarchive one to put it back in the list.",
} as const;

export const MANAGE_LABELS = {
  more: "Manage conversations",
  noun: "conversation",
  archive: "Archive",
  unarchive: "Unarchive",
  delete: "Delete…",
  deleteTooltip: "Delete conversation",
  archiveAll: "Archive all finished",
  deleteAll: "Delete all finished…",
  emptyArchive: "Empty archive…",
  archived: "Archived {count}",
  unarchived: "Restored {count}",
  deleted: "Deleted {count}",
  undo: "Undo",
  failed: "Couldn't update conversations: {error}",
  loadFailed: "Couldn't load archived conversations: {error}",
  confirmTitle: "Delete {count}?",
  confirmBody: "{count} will be removed permanently. This can't be undone.",
  confirmYes: "Delete",
  confirmNo: "Cancel",
} as const;

export const ATTENTION_LABELS = {
  openRun: "Open",
  openTerminal: "Open terminal",
  download: "Download",
  markRead: "Mark as read",
  marked: "Marked as read",
  failed: "Couldn't mark as read: {error}",
} as const;

export const ATTENTION_OPEN_LABELS = {
  file: ATTENTION_LABELS.download,
  run: ATTENTION_LABELS.openRun,
  terminal: ATTENTION_LABELS.openTerminal,
} as const;

export const ATTACHMENT_LABELS = {
  tooLarge: "{name} is larger than {limit}.",
  tooMany: "You can attach up to {limit} files to one message.",
  unreadable: "Couldn't read {name}: {error}",
  noPath: "{name} isn't a local file, so it can't be attached.",
  emptyClipboard: "There's no image on the clipboard to paste.",
  paste: "Paste image",
  promptImage: "Take a look at this image.",
  promptImages: "Take a look at these images.",
  promptFile: "Take a look at the attached file.",
  promptFiles: "Take a look at the attached files.",
} as const;

export const DETAIL_LABELS = {
  empty: "No conversation selected",
} as const;

export const NEW_LABELS = {
  title: "New conversation",
  placeholder: "What should Claude do?",
  send: "Start conversation",
  close: "Close",
  project: "Project",
  failed: "Couldn't start Claude: {error}",
} as const;

export const SUGGESTIONS: readonly { label: string; prompt: string }[] = [
  { label: "Explain this project", prompt: "Explain how this project is structured and how to run it." },
  { label: "Fix failing tests", prompt: "Run the test suite, find the failing tests and fix them." },
  { label: "Review changes", prompt: "Review the uncommitted changes and point out bugs or risky edits." },
  { label: "Write a README", prompt: "Write a concise README with setup, scripts and project layout." },
  { label: "Build & report", prompt: "Build the project and report any errors with suggested fixes." },
];

export const CONVERSATION_LABELS = {
  session: "Session {id}",
  you: "You",
  claude: "Claude",
  copySession: "Copy session id",
  more: "More actions",
  copied: "Session id copied",
  cancel: "Stop",
  cancelTooltip: "Stop this run",
  openTerminal: "Open terminal",
  download: "Download",
  reload: "Reload",
  loading: "Loading conversation…",
  loadFailedTitle: "Couldn't load this conversation",
  retry: "Try again",
  dismiss: "Dismiss",
  waiting: "Claude is thinking…",
  jump: "Jump to latest",
  continues: "Continues “{title}”",
  followUpPlaceholder: "Reply to Claude…",
  followUpRunning: "Claude is still working. You can reply when this run ends.",
  followUpNoSession: "This run has no Claude session to continue. Start a new conversation instead.",
  followUpSend: "Reply",
  reconnecting: "Live output dropped. Reconnecting…",
  polling: "Live output unavailable here; refreshing every few seconds.",
  cancelFailed: "Couldn't stop the run: {error}",
  cancelConfirmTitle: "Stop Claude?",
  cancelConfirmBody: "The run is cancelled. Work already written to the project stays.",
  cancelConfirmYes: "Stop run",
  cancelConfirmNo: "Keep running",
  toolInput: "Input",
  toolOutput: "Result",
  resultDone: "Finished",
  resultFailed: "Run failed",
  resultCancelled: "Run cancelled",
  copyCode: "Copy",
  codeCopied: "Copied to clipboard",
} as const;

export const TIME_LABELS = {
  justNow: "just now",
  minutesAgo: "{n}m ago",
  hoursAgo: "{n}h ago",
  daysAgo: "{n}d ago",
} as const;

export const TOKEN_LABELS = {
  one: "token",
  many: "tokens",
} as const;

export function formatLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
