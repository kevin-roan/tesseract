import type { BannerProps } from "./Banner";

export const BANNER_SAMPLES: Omit<BannerProps, "onButton">[] = [
  { title: "No sandbox is configured on this machine yet.", tone: "neutral", buttonLabel: "Set Up" },
  { title: "Looking for the sandbox on this machine…", tone: "info" },
  { title: "Can't reach the sandbox: connection refused", tone: "danger", buttonLabel: "Retry" },
  { title: "The sandbox rejected the saved token.", tone: "warning", buttonLabel: "Fix Connection" },
];
