export const GIT_LABELS = {
  none: "Not a git repository",
  detached: "detached",
  ahead: (count: number) => `↑${count}`,
  behind: (count: number) => `↓${count}`,
  clean: "Clean",
  inSync: "In sync",
  files: "Working tree",
  filesEmpty: "Nothing to commit, working tree clean.",
  log: "Recent commits",
  logEmpty: "No commits yet.",
  error: (error: string) => `Couldn't read git status: ${error}`,
  filesList: "Changed files",
  logList: "Commits",
} as const;

export const GIT_CHANGE_NAMES: Readonly<Record<string, string>> = {
  M: "Modified",
  A: "Added",
  D: "Deleted",
  R: "Renamed",
  C: "Copied",
  U: "Conflict",
  "?": "Untracked",
  "!": "Ignored",
  T: "Type changed",
};
