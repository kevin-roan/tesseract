import type { DockerActionKey, DockerInstallOption, DockerPhase } from "../../../shared/contracts/docker";
import type { OnboardingUrlKey } from "../../../shared/contracts/onboarding";
import type { Platform } from "../../../shared/runtime";

export const DOCKER_QUERY_KEYS = {
  report: ["docker", "report"],
  phase: ["docker", "phase"],
  log: ["docker", "log"],
} as const;

export const DOCKER_LOG_LIMIT = 200;

export const START_TICK_MS = 1000;

export const REQUIRED_CHECKS: Record<Platform, readonly string[]> = {
  linux: ["cli", "daemon", "compose", "buildx", "resources"],
  darwin: ["cli", "daemon", "compose", "buildx", "resources"],
  win32: ["cli", "daemon", "compose", "buildx", "resources", "wsl"],
};

export const PLACEHOLDER_CHECKS = ["cli", "daemon", "compose", "buildx"] as const;

export const BUSY_PHASES: readonly DockerPhase["kind"][] = ["checking", "installing", "starting"];
export const OPERATION_PHASES: readonly DockerPhase["kind"][] = ["installing", "starting"];

export const DOCS_ACTIONS: Partial<Record<DockerActionKey, OnboardingUrlKey>> = {
  "compose-docs": "docker_compose_install",
  "buildx-docs": "docker_buildx_install",
  "virtualization-docs": "virtualization_help",
};

export const INSTALL_ACTIONS: Partial<Record<DockerActionKey, DockerInstallOption>> = {
  "install-wsl": "wsl",
  "update-wsl": "wsl",
};

export const LICENSED_OPTIONS: readonly DockerInstallOption[] = ["desktop", "desktop-user"];

export const BROWSER_OPTIONS: readonly DockerInstallOption[] = ["desktop-linux", "manual"];

export const PLATFORM_INSTALL_OPTIONS: Record<Platform, readonly DockerInstallOption[]> = {
  darwin: ["desktop", "manual"],
  win32: ["desktop", "desktop-user", "manual"],
  linux: ["engine", "desktop-linux", "manual"],
};


export const PRIMARY_ACTIONS: readonly DockerActionKey[] = ["install", "start"];
