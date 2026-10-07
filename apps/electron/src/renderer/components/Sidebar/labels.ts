export const SIDEBAR_LABELS = {
  appName: "Monolith",
  mainMenu: "Main menu",
  noProject: "No project",
  noRuns: "No conversations yet",
  untitledRun: "Untitled conversation",
  expand: "Show conversations",
  collapse: "Hide conversations",
  confidential: "Confidential",
  running: (count: number) => `${count} running`,
  openProject: (name: string) => `Open ${name}`,
  newInProject: (name: string) => `New conversation in ${name}`,
} as const;
