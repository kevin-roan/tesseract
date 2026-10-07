export const SECTION_SAMPLES = {
  resources: { title: "Resources", subtitle: "Share of capacity", actionLabel: "View all" },
  toolchain: { title: "Toolchain", emptyLabel: "The controller reported no tools." },
  activity: { title: "Activity", loadingLabel: "Loading activity" },
  rows: [
    ["Branch", "main"],
    ["Remote", "origin/main"],
  ],
} as const;
