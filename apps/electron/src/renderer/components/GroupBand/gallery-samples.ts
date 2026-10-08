export const GROUP_BAND_SAMPLES = {
  processes: { title: "Processes", icon: "processes", count: 3, actionLabel: "New process" },
  commits: { title: "Commits", icon: "commit", count: 0, emptyLabel: "No commits yet." },
  ports: { title: "Listening ports", icon: "ports", subtitle: "Servers started from this project" },
  builds: { title: "Builds", icon: "sessions", loadingLabel: "Loading builds" },
  toolbarLabel: "Projects filter",
  referenceWidth: 952,
  toggles: [
    { id: "filter", icon: "filter", label: "Search projects" },
    { id: "display", icon: "display-options", label: "Group by status" },
  ],
  projectFilter: {
    label: "Filter by project",
    value: "all",
    options: [
      { id: "all", label: "All projects" },
      { id: "tesseract", label: "tesseract" },
      { id: "streaxfit", label: "streaxfit" },
    ],
  },
} as const;
