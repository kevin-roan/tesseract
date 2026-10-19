import type { ProjectRuntime } from "@tesseract/protocol";
import { TerminalWindowIcon } from "phosphor-react-native";

import type { StatusBadgeProps } from "@/components/status-badge";

export const HOST_RUNTIME_COPY = {
  badge: "Host shell",
  notice: (path: string) =>
    `Runs directly on the host, without a sandbox. Claude, scripts and terminals change ${path} in place, with the host user's permissions.`,
  emptyProjects: "No host projects yet. Run tesseract --unsafe-repo in a repository on the host to add one.",
} as const;

const SANDBOX_EMPTY_PROJECTS = "No projects in /workspace/projects yet. Clone a repository or start an empty one, or ask Claude to.";

export const projectsEmptyLabel = (onHost: boolean): string => (onHost ? HOST_RUNTIME_COPY.emptyProjects : SANDBOX_EMPTY_PROJECTS);

export const isHostRuntime = (runtime: ProjectRuntime | undefined): boolean => runtime === "host";

export function runtimeBadge(runtime: ProjectRuntime | undefined): StatusBadgeProps | undefined {
  return isHostRuntime(runtime) ? { label: HOST_RUNTIME_COPY.badge, tone: "warning", icon: TerminalWindowIcon } : undefined;
}
