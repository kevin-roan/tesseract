export const FILES_LABELS = {
  title: "Files",
  refresh: "Refresh",
  empty: "Build outputs and files Claude shares with theone-controller share show up here.",
  emptyTitle: "No files yet",
  noMatch: "No files match these filters.",
  loading: "Loading files…",
  errorTitle: "Couldn't load files",
  retry: "Try again",
  dismiss: "Dismiss",
  projectFilter: "Filter by project",
  sourceFilter: "Filter by source",
  allProjects: "All projects",
  allSources: "All sources",
  view: "Files view",
  noProject: "No project",
} as const;

export const VIEW_LABELS = {
  shared: "Shared files",
  builds: "Project builds",
} as const;

export const OUTPUT_LABELS = {
  emptyTitle: "No builds found",
  errorTitle: "Couldn't look for builds",
  empty: "APKs, AABs, installers and AppImages in your projects' build, dist, release and out folders show up here.",
  noMatch: "No builds match this project.",
  loading: "Looking for builds…",
  missing: "{name} is no longer in the project. Rebuild it or refresh the list.",
} as const;

export const SOURCE_LABELS = {
  build: "Build",
  agent: "Shared by Claude",
} as const;

export const ARTIFACT_LABELS = {
  save: "Save…",
  open: "Open download link",
  send: "Send to device",
  delete: "Delete",
  saved: "Saved {name}",
  downloading: "Downloading {name}",
  progress: "Downloading",
  failed: "Download failed: {error}",
  missing: "{name} is no longer available in the sandbox.",
  missingUnknown: "That file is no longer available in the sandbox.",
  checksum: "The downloaded file does not match the artifact checksum, so it was discarded.",
  saveUnavailable: "Saving files isn't available in this window.",
} as const;

export const DELETE_LABELS = {
  title: "Delete {name}?",
  body: "The file is removed from the sandbox. This can't be undone.",
  confirm: "Delete",
  cancel: "Cancel",
  done: "Deleted {name}",
  failed: "Couldn't delete {name}: {error}",
} as const;

export const TAILDROP_LABELS = {
  title: "Send {name}",
  body: "Taildrop sends the file to a device on your tailnet.",
  target: "Device",
  confirm: "Send",
  cancel: "Cancel",
  noTargets: "No Taildrop devices are online.",
  sending: "Sending {name} to {device}",
  sent: "Sent {name} to {device}",
  failed: "Couldn't send {name}: {error}",
} as const;

export const EMPTY_PLATFORM = "—";

export function formatLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
