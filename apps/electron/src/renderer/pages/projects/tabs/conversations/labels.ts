export const CONVERSATIONS_LABELS = {
  list: "Chats",
  empty: "No chats about this project yet.",
  newChat: "New chat",
  open: "Open chat",
  untitled: "Untitled chat",
  active: "Active",
  loading: "Loading chats",
  sources: { "agent-run": "Agent run", terminal: "Terminal", cli: "Claude Code" } as Record<string, string>,
  runStates: { running: "Working", succeeded: "Done", failed: "Failed", cancelled: "Cancelled" } as Record<string, string>,
} as const;
