export const LOG_PANEL_LABELS = {
  close: "Close logs",
  empty: "Waiting for output…",
  jump: "Jump to latest output",
  status: {
    connecting: "Connecting",
    live: "Live",
    ended: "Ended",
    exited: (code: number | string) => `Exited ${code}`,
    stopped: "Stopped",
  },
  snapshotNotice: "Live logs unavailable: showing a snapshot",
} as const;
