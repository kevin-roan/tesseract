import type { EmptyStateProps } from "./EmptyState";

const noop = (): void => undefined;

export const EMPTY_STATE_SAMPLES: readonly (EmptyStateProps & { key: string })[] = [
  {
    key: "projects",
    icon: "projects",
    title: "No projects yet",
    message: "Create a project in the sandbox to see it here.",
    actionLabel: "New project",
    onAction: noop,
    secondaryLabel: "Learn more",
    onSecondary: noop,
  },
  { key: "loading", loading: true, title: "Connecting to the sandbox", message: "This can take a few seconds." },
];
