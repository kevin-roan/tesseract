import type { ContainersActionKey } from "../../../../shared/contracts/containers";

export const CONTAINERS_SETTINGS_LABELS = {
  title: "Containers",
  checks: {
    title: "Requirements",
    description: "Containers are Linux servers with their own Docker, run under the sysbox runtime and joined to your tailnet.",
    refresh: "Check again",
    building: "Building the server image…",
    actions: { "install-sysbox": "Install guide", "build-image": "Build image" } satisfies Partial<Record<ContainersActionKey, string>>,
    cancelBuild: "Cancel build",
  },
  policy: {
    title: "Tailnet policy",
  },
} as const;
