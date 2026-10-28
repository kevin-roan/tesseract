export const PROFILE_COPY = {
  sandboxTitle: "Sandbox",
  pairAnother: "Pair another",
  accountTitle: "Account",
  preferencesTitle: "Preferences",
  moreTitle: "More",
  tailscaleMissingTitle: "Tailscale identity not exposed",
  tailscaleMissing:
    "This sandbox doesn't share who you are on the tailnet. Start it with --tailscale-api (TESSERACT_TAILSCALE_LOCALAPI=1) to show your Tailscale profile.",
  retry: "Retry",
} as const;

export const ACTIVITY_COPY = {
  title: "Activity",
  subtitle: "Builds, Claude runs and processes",
  loading: "Loading activity…",
  empty: "No activity yet",
  emptyMessage: "Builds, Claude runs and processes on this sandbox show up here.",
  askClaude: "Ask Claude",
  retry: "Retry",
} as const;
