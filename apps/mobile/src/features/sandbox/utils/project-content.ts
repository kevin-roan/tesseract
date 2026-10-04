export const PROJECT_COPY = {
  title: "Project",
  failedTitle: "Couldn't load this project",
  retry: "Try again",
  loading: "Loading project…",
  waitingForOutput: "Waiting for output…",
  sections: {
    git: "Git",
    sites: "Websites",
    scripts: "Scripts",
    build: "Build",
    processes: "Processes",
    builds: "Recent builds",
    artifacts: "Artifacts",
  },
  empty: {
    scripts: "No package scripts found.",
    build: "No build targets detected.",
    processes: "Nothing has run here yet.",
    artifacts: "No artifacts yet.",
  },
  needsInstall: "Dependencies aren't installed yet. Run installs them first.",
} as const;
