export type HomeStatus = {
  id: "offline" | "inbox" | "build";
  title: string;
  message?: string | null;
  progress?: number | null;
  actionLabel: string;
  onAction: () => void;
};

export const HOME_STATUS_COPY = {
  inboxTitle: "Claude is waiting for your answer",
  inboxAction: "Open inbox",
  buildAction: "View",
  offlineTitle: "Sandbox unreachable",
  offlineMessage: "Check that the sandbox is running and Tailscale is connected on this device.",
  offlineAction: "Details",
} as const;

export const UNREACHABLE_GRACE_MS = 4_000;

type StatusInput = {
  offline?: { view: () => void } | null;
  attention: string | null;
  openInbox: () => void;
  build: { title: string; message: string; progress: number | null; view: () => void } | null;
};

export function homeStatus({ offline, attention, openInbox, build }: StatusInput): HomeStatus | null {
  if (offline) {
    return {
      id: "offline",
      title: HOME_STATUS_COPY.offlineTitle,
      message: HOME_STATUS_COPY.offlineMessage,
      actionLabel: HOME_STATUS_COPY.offlineAction,
      onAction: offline.view,
    };
  }
  if (attention) {
    return {
      id: "inbox",
      title: HOME_STATUS_COPY.inboxTitle,
      message: attention,
      actionLabel: HOME_STATUS_COPY.inboxAction,
      onAction: openInbox,
    };
  }
  if (build) {
    return {
      id: "build",
      title: build.title,
      message: build.message,
      progress: build.progress,
      actionLabel: HOME_STATUS_COPY.buildAction,
      onAction: build.view,
    };
  }
  return null;
}
