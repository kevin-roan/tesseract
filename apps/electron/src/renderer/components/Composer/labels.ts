export const COMPOSER_LABELS = {
  attach: "Attach",
  files: "Files…",
  images: "Images…",
  paste: "Paste image",
  stop: "Stop",
  remove: "Remove {name}",
  retry: "Retry {name}",
  slashHints: "Commands",
  followUpPlaceholder: "Reply to Claude…",
  followUpSend: "Reply",
  newPlaceholder: "What should Claude do?",
  newSend: "Start conversation",
  lockedRunning: "Claude is still working. You can reply when this run ends.",
  lockedNoSession: "This run has no Claude session to continue. Start a new conversation instead.",
} as const;

export const formatLabel = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
