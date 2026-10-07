import type { OnboardingUrlKey } from "../../shared/contracts/onboarding";

export const ONBOARDING_URLS: Record<OnboardingUrlKey, string> = {
  docker_mac_docs: "https://docs.docker.com/desktop/setup/install/mac-install/",
  docker_windows_docs: "https://docs.docker.com/desktop/setup/install/windows-install/",
  docker_desktop_linux_docs: "https://docs.docker.com/desktop/setup/install/linux/",
  docker_engine_docs: "https://docs.docker.com/engine/install/",
  docker_compose_install: "https://docs.docker.com/compose/install/linux/",
  docker_buildx_install: "https://docs.docker.com/build/concepts/overview/#install-buildx",
  docker_ssa: "https://www.docker.com/legal/docker-subscription-service-agreement/",
  virtualization_help: "https://docs.docker.com/desktop/troubleshoot-and-support/troubleshoot/topics/#virtualization",
  tailscale_keys: "https://login.tailscale.com/admin/settings/keys",
  android_accel_docs: "https://developer.android.com/studio/run/emulator-acceleration",
  claude_code_docs: "https://docs.claude.com/en/docs/claude-code/setup",
};

export const DOWNLOAD_URLS = {
  dockerMacDmg: (arch: "arm64" | "amd64") => `https://desktop.docker.com/mac/main/${arch}/Docker.dmg`,
  dockerMacChecksums: (arch: "arm64" | "amd64") => `https://desktop.docker.com/mac/main/${arch}/checksums.txt`,
  dockerMacAppcast: (arch: "arm64" | "amd64") => `https://desktop.docker.com/mac/main/${arch}/appcast.xml`,
  dockerWinExe: (arch: "amd64" | "arm64") => `https://desktop.docker.com/win/main/${arch}/Docker%20Desktop%20Installer.exe`,
  dockerWinChecksums: (arch: "amd64" | "arm64") => `https://desktop.docker.com/win/main/${arch}/checksums.txt`,
  dockerGetScript: "https://get.docker.com",
} as const;
