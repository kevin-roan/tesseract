import type { VmSize } from "../../shared/contracts/vm";

export const VM_PROFILE = "tesseract";
export const VM_CONTEXT = `colima-${VM_PROFILE}`;
export const COLIMA_SSH = ["ssh", "-p", VM_PROFILE, "--"] as const;
export const COLIMA_LOG_LINE = /^\s*(?:[A-Z]{4}\[\d+\]|time=")/;
export const COLIMA_STATUS = { running: "Running", broken: "Broken" } as const;
export const VM_COMMANDS = {
  start: `colima start ${VM_PROFILE}`,
  sysboxStatus: `colima ssh -p ${VM_PROFILE} -- systemctl status sysbox-mgr sysbox-fs`,
  provisionLog: `colima ssh -p ${VM_PROFILE} -- sudo tail -n 50 /var/log/cloud-init-output.log`,
} as const;
export const VM_DEFAULT_SIZE: VmSize = { cpus: 6, memoryGb: 5, diskGb: 120 };

export const COLIMA_DIR = ".colima";
export const COLIMA_CONFIG_FILE = "colima.yaml";
export const COLIMA_SOCKET_FILE = "docker.sock";
export const COLIMA_HOME_ENV = "COLIMA_HOME";
export const DOCKER_CONFIG_ENV = "DOCKER_CONFIG";
export const DOCKER_CONFIG_DIR = ".docker";
export const DOCKER_CONFIG_FILE = "config.json";
export const CLI_PLUGINS_DIR = "lib/docker/cli-plugins";
export const CLI_PLUGINS_KEY = "cliPluginsExtraDirs";
export const CREDS_STORE_KEY = "credsStore";
export const DESKTOP_CREDS_STORE = "desktop";

export const MANAGED_MARKER = "tesseract-managed";

export const SYSBOX_RUNTIME = "sysbox-runc";
export const SYSBOX_RUNC_PATH = "/usr/bin/sysbox-runc";
export const SYSBOX_VERSION = "0.7.1";
export const SYSBOX_CACHE_DIR = "/var/cache/tesseract";
export const SYSBOX_SERVICES = ["sysbox-mgr", "sysbox-fs"] as const;
export const SYSBOX_DOWNLOAD_HOST = "downloads.nestybox.com";
export const SYSBOX_PACKAGES = {
  arm64: {
    url: `https://${SYSBOX_DOWNLOAD_HOST}/sysbox/releases/v${SYSBOX_VERSION}/sysbox-ce_${SYSBOX_VERSION}-0.linux_arm64.deb`,
    sha256: "04ca894ae0b53f0fa54eaacc173ce40363c9a95ea5450f773716a84ef650a69b",
  },
  amd64: {
    url: `https://${SYSBOX_DOWNLOAD_HOST}/sysbox/releases/v${SYSBOX_VERSION}/sysbox-ce_${SYSBOX_VERSION}-0.linux_amd64.deb`,
    sha256: "9d6d5484f980d0a17f86c492c1262015c2afb66280bdb97215b79fde6a0261c5",
  },
} as const;

export const BREW_CANDIDATES = ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"] as const;
export const BREW_INSTALL_COMMAND =
  '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
export const BREW_TOOLS = [
  { formula: "colima", key: "colima", binary: "colima" },
  { formula: "docker", key: "docker", binary: "docker" },
  { formula: "docker-compose", key: "compose", binary: "docker-compose" },
  { formula: "docker-buildx", key: "buildx", binary: "docker-buildx" },
] as const;

export const DOCKER_DESKTOP_PROCESSES = ["Docker Desktop", "com.docker.backend"] as const;

export const BREW_INSTALL_TIMEOUT_MS = 30 * 60_000;
export const VM_START_TIMEOUT_MS = 20 * 60_000;
export const VM_STOP_TIMEOUT_MS = 2 * 60_000;
export const SYSBOX_WAIT_MS = 5 * 60_000;
export const SYSBOX_POLL_MS = 3_000;
export const SYSBOX_SETTLE_MS = 30_000;
export const SYSBOX_PROVISION_TIMEOUT_MS = 15 * 60_000;
export const PROVISION_REVISION = 2;
export const FALLBACK_DNS = ["1.1.1.1", "8.8.8.8"] as const;
export const PROVISION_RETRY = { dnsAttempts: 60, dnsFallbackAttempt: 15, dnsDelaySeconds: 2, aptAttempts: 3, aptDelaySeconds: 5, curlAttempts: 5, curlDelaySeconds: 2 } as const;
