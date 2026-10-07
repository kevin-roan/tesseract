import type { DockerKind } from "../../shared/contracts/docker";

export const KIND_LABELS: Record<DockerKind, string> = {
  engine: "Docker Engine",
  desktop: "Docker Desktop",
  rootless: "Docker (rootless)",
  podman: "Podman",
  colima: "Colima",
  orbstack: "OrbStack",
  unknown: "Docker",
};

export const CHECK_TITLES = {
  cli: "Docker",
  daemon: "Engine",
  compose: "Docker Compose",
  buildx: "BuildKit",
  engineVersion: "Engine version",
  resources: "Resources",
  group: "docker group",
  rootless: "Rootless mode",
  wsl: "WSL 2",
  virtualization: "Virtualization",
  podman: "Podman",
} as const;

export const CHECK_DETAILS = {
  cliOk: (kind: string, version: string) => `${kind} ${version}`,
  cliMissing: "Docker isn't installed",
  daemonOk: (os: string, arch: string, context: string | null) =>
    ["Running", `${os}/${arch}`, context].filter(Boolean).join(" · "),
  daemonStopped: "The Docker engine isn't running",
  daemonPermission: "You don't have access to the Docker engine",
  daemonUnresponsive: "The Docker engine doesn't answer",
  daemonUnknown: "Checking the engine…",
  composeMissing: "Docker Compose v2 is missing",
  composeOld: (version: string) => `Docker Compose ${version} is too old; 2.24 or newer is needed`,
  buildxOk: (version: string) => `buildx ${version}`,
  buildxMissing: "docker buildx is missing; the image needs BuildKit",
  engineOld: (version: string) => `Docker ${version} is older than 24; update if the build fails`,
  resourcesOk: (cpus: number, mem: string) => `${cpus} CPUs · ${mem} GB for containers`,
  resourcesLow: (cpus: number, mem: string) =>
    `The engine has ${cpus} CPUs and ${mem} GB of memory; the sandbox needs at least 2 CPUs and 4 GB`,
  resourcesLimited: (mem: string) => `The sandbox is limited to ${mem} GB (it asks for 8 GB)`,
  resourcesDesktopHint: " · raise it in Docker Desktop › Settings › Resources",
  groupOk: (user: string) => `${user} is in the docker group`,
  groupMissing: (user: string) => `${user} isn't in the docker group`,
  groupPending: (user: string) => `${user} was added to the docker group; log out and back in to use it`,
  rootless:
    "With rootless Docker the sandbox can't share ~/.claude with this computer (file owners don't match). Claude Code inside the sandbox may not be signed in.",
  wslOk: (version: string) => `WSL ${version}`,
  wslMissing: "WSL 2 isn't installed",
  wslOld: (version: string) => `WSL ${version} is too old; 2.1.5 or newer is needed`,
  virtualizationOk: "Enabled",
  virtualizationOff: "Hardware virtualization is off; turn it on in the BIOS/UEFI settings",
  podman:
    "Podman isn't supported yet: the sandbox needs Docker Compose 2.24+ features and BuildKit cache mounts. Install Docker Engine or Docker Desktop.",
} as const;

export const PLATFORM_MESSAGES = {
  windowsTooOld:
    "Docker Desktop needs Windows 10 22H2 (build 19045) or Windows 11 23H2 (build 22631) or newer",
  macTooOld: (min: string) => `Docker Desktop needs macOS ${min} or newer`,
} as const;

export const PHASE_MESSAGES = {
  startTimeout: (seconds: number) => `The engine didn't start within ${seconds} seconds`,
  startPermission: "You don't have access to the Docker engine",
  installCancelled: "Installation cancelled",
  startCancelled: "Starting Docker was cancelled",
  acceptLicense: "Accept the Docker Subscription Service Agreement to install Docker Desktop",
  unsupportedOption: (option: string, platform: string) => `"${option}" isn't available on ${platform}`,
  manualInstall: "Monolith can't install Docker on this system automatically. Run the commands below in a terminal.",
  noPkexec: "pkexec isn't available, so Monolith can't ask for your password. Run the commands below in a terminal.",
  noAgent: "No password prompt is available (no polkit agent). Run the commands below in a terminal.",
  checksumMismatch: (file: string) => `The download of ${file} is damaged (checksum mismatch). Try again.`,
  downloadFailed: (status: number) => `The download failed (HTTP ${status})`,
  installFailed: (code: number | null) => `The installer failed (exit code ${code ?? "unknown"})`,
  commandFailed: (detail: string) => `The command failed: ${detail}`,
  noStartCommand: "Monolith doesn't know how to start this Docker engine. Start it yourself, then check again.",
} as const;

export const LOG_MESSAGES = {
  run: (command: string) => `$ ${command}`,
  download: (url: string) => `Downloading ${url}`,
  resume: (bytes: number) => `Resuming the download at ${bytes} bytes`,
  cached: (file: string) => `Using the downloaded ${file}`,
  sha256: (file: string, hash: string) => `sha256 ${hash}  ${file}`,
  noChecksum: (file: string) => `No checksum is published for ${file}; skipping verification`,
  exit: (code: number | null) => `exit code ${code ?? "unknown"}`,
  polling: (seconds: number) => `Waiting for the engine (${seconds}s)`,
  ready: "The Docker engine is running",
  elevated: (command: string) => `${command} (as administrator)`,
  dockerUsers: (user: string) =>
    `If ${user} isn't the administrator who approved the install, run: net localgroup docker-users ${user} /add (membership in docker-users gives full control of this computer, like an administrator).`,
} as const;

export const SERVICE_MESSAGES = {
  busy: "Another Docker operation is running",
  invalidRequest: "Choose how to install Docker",
} as const;
