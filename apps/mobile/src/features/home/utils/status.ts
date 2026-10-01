export type HomeStatus = {
  id: "inbox" | "build";
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
} as const;

type StatusInput = {
  attention: string | null;
  openInbox: () => void;
  build: { title: string; message: string; progress: number | null; view: () => void } | null;
};

export function homeStatus({ attention, openInbox, build }: StatusInput): HomeStatus | null {
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
