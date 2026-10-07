export const DOCKER_TIMEOUT_MS = 15_000;
export const ENGINE_START_POLL_MS = 2_000;
export const ENGINE_START_TIMEOUT_MS = { default: 120_000, win32: 180_000 } as const;
export const INSTALL_TIMEOUT_MS = 45 * 60_000;
export const ELEVATED_TIMEOUT_MS = 10 * 60_000;
export const PROGRESS_INTERVAL_MS = 150;

export const MIN_COMPOSE_VERSION = "2.24.0";
export const MIN_ENGINE_VERSION = "24.0.0";
export const MIN_WSL_VERSION = "2.1.5";
export const MIN_MAC_OS_VERSION = "14.0.0";
export const MIN_WIN10_BUILD = 19045;
export const WIN11_FIRST_BUILD = 22000;
export const MIN_WIN11_BUILD = 22631;

export const MIN_CPUS = 2;
export const MIN_MEM_BYTES = 4 * 1024 ** 3;
export const WANTED_MEM_BYTES = 8 * 1024 ** 3;
export const GIB = 1024 ** 3;

export const DOCKER_SOCKET = "/var/run/docker.sock";
export const SYSTEMD_RUN_DIR = "/run/systemd/system";
export const OS_RELEASE = "/etc/os-release";
export const DOCKER_GROUP = "docker";
export const KVM_GROUP = "kvm";
export const DOCKER_SERVICE = "docker.service";
export const DOCKER_DESKTOP_USER_SERVICE = "docker-desktop";

export const MAC_DESKTOP_APP = "Docker.app";
export const MAC_DMG = "Docker.dmg";
export const MAC_INSTALLER_DISPLAY = "Docker.app/Contents/MacOS/install --accept-license";
export const WIN_INSTALLER = "Docker Desktop Installer.exe";
export const WIN_DESKTOP_EXE = "Docker Desktop.exe";
export const GET_DOCKER_SCRIPT = "get-docker.sh";
export const GET_DOCKER_SHEBANG = "#!/bin/sh";
export const GET_DOCKER_LAST_LINE = "do_install";
export const PART_SUFFIX = ".part";

export const PKEXEC_DISMISSED = 126;
export const PKEXEC_NO_AGENT = 127;
export const OSASCRIPT_CANCELLED = -128;
export const WINDOWS_REBOOT_REQUIRED = 3010;
export const WINDOWS_UAC_CANCELLED = 1223;

export const CONVENIENCE_SCRIPT_DISTROS = ["ubuntu", "debian", "raspbian", "fedora", "centos", "rhel"] as const;
export const ARCH_DISTROS = ["arch"] as const;
export const SUSE_DISTROS = ["opensuse", "opensuse-leap", "opensuse-tumbleweed", "suse", "sles"] as const;

export const ARCH_PACKAGES = ["docker", "docker-compose", "docker-buildx"] as const;
export const SUSE_PACKAGES = ["docker", "docker-compose", "docker-buildx"] as const;

export const DAEMON_PERMISSION_MARKERS = ["permission denied"] as const;
export const DAEMON_SOCKET_MARKER = "docker.sock";

export const KNOWN_CONTEXT_KINDS = {
  "desktop-linux": "desktop",
  rootless: "rootless",
  colima: "colima",
  orbstack: "orbstack",
} as const;

export const REQUIRED_CHECKS = ["cli", "daemon", "compose", "buildx", "resources", "podman"] as const;
export const REQUIRED_WINDOWS_CHECKS = ["wsl"] as const;
