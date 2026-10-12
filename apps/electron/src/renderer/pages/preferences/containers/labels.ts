import type { ContainersActionKey } from "../../../../shared/contracts/containers";

export const CONTAINERS_SETTINGS_LABELS = {
  title: "Containers",
  checks: {
    title: "Requirements",
    description: "Containers are Linux servers with their own Docker, run under the sysbox runtime and joined to your tailnet.",
    refresh: "Check again",
    actions: { "install-sysbox": "Install guide", "setup-vm": "Set up VM", "build-image": "Build image" } satisfies Partial<Record<ContainersActionKey, string>>,
    progress: { "setup-vm": "Setting up the Tesseract VM…", "build-image": "Building the server image…" } satisfies Partial<Record<ContainersActionKey, string>>,
    cancel: { "setup-vm": "Cancel setup", "build-image": "Cancel build" } satisfies Partial<Record<ContainersActionKey, string>>,
  },
  policy: {
    title: "Tailnet policy",
  },
} as const;
