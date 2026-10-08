import type { ReachabilityMode, SandboxComponent, WhisperModel } from "../../shared/contracts/sandbox";

export const DEFAULT_PROJECT = "tesseract";
export const DEFAULT_IMAGE = "tesseract/sandbox:latest";
export const DEFAULT_CONTROLLER_PORT = 7700;
export const DEFAULT_VNC_PORT = 5901;
export const DEFAULT_FLUTTER_VERSION = "3.47.5";
export const DEFAULT_CLAUDE_CODE_VERSION = "latest";
export const DEFAULT_HOSTNAME = "tesseract-sandbox";
export const DEFAULT_MODE: ReachabilityMode = "local";
export const LOCAL_BIND_ADDR = "127.0.0.1";
export const DEFAULT_TIME_ZONE = "UTC";
export const DEFAULT_IDS = { uid: 1000, gid: 1000 } as const;
export const SERVICE = "sandbox";
export const CONTAINER_CONTROLLER_PORT = 7700;
export const EXEC_USER = "dev";

export const COMPONENTS: readonly SandboxComponent[] = ["android", "flutter", "mono", "whisper"];
export const WHISPER_MODELS: readonly WhisperModel[] = ["base", "small", "medium", "large-v3-turbo"];
export const DEFAULT_WHISPER_MODELS: readonly WhisperModel[] = ["base", "small"];
export const MODES: readonly ReachabilityMode[] = ["local", "tailscale", "host-tailscale"];

export const DEFAULT_CPUS = 4;
export const DEFAULT_MEMORY_GB = 8;
export const MIN_MEMORY_GB = 2;
export const MEMORY_DEFAULT_SHARE = 0.75;
export const GIB = 1024 ** 3;
export const GB = 1e9;

export const HEALTH_POLL_MS = 2_000;
export const HEALTH_TIMEOUT_MS = 180_000;
export const HEALTH_PROBE_TIMEOUT_MS = 2_000;
export const PROTOCOL_VERSION = 1;
export const DOCKER_TIMEOUT_MS = 15_000;
export const TAILSCALE_TIMEOUT_MS = 3_000;
export const CANCEL_GRACE_MS = 5_000;
export const FAILURE_LOG_TAIL = 50;
export const FAILURE_VERTEX_LOG_TAIL = 20;
export const DEFAULT_LOG_TAIL = 200;
export const TOKEN_BYTES = 32;

export const SCRUBBED_ENV_PREFIXES = ["TESSERACT_"] as const;
export const SCRUBBED_ENV_NAMES = ["COMPOSE_PROJECT_NAME", "COMPOSE_FILE", "COMPOSE_PROFILES"] as const;
export const SANDBOX_IMAGE_REF_ENV = "TESSERACT_SANDBOX_IMAGE_REF";

export const COMPOSE_DIR = ["infra", "compose"] as const;
export const DOCKERFILE = ["infra", "docker", "sandbox", "Dockerfile"] as const;
export const BUILD_WEIGHTS_FILE = "build-weights.json";
export const BUILD_TARGET = "sandbox";
export const COMPOSE_FILES = {
  base: "compose.yml",
  local: "compose.local.yml",
  tailscale: "compose.tailscale.yml",
  dind: "compose.dind.yml",
  tailscaleApiSidecar: "compose.tailscale-api-sidecar.yml",
  tailscaleApi: "compose.tailscale-api.yml",
} as const;
export const TAILSCALE_HOST_SOCKET_DIR = "/var/run/tailscale";
export const TAILSCALE_SOCKET = "tailscaled.sock";
export const STATE_SUBDIR = "tesseract";

export const LABELS = {
  project: "com.docker.compose.project",
  service: "com.docker.compose.service",
  configFiles: "com.docker.compose.project.config_files",
  workingDir: "com.docker.compose.project.working_dir",
  imageVersion: "org.opencontainers.image.version",
} as const;

export const PATTERNS = {
  project: /^[a-z0-9][a-z0-9_-]*$/,
  volumePrefix: /^[A-Za-z0-9][A-Za-z0-9_.-]*$/,
  port: /^[1-9][0-9]{0,4}$/,
  tailnetDomain: /^[a-z0-9-]+(\.[a-z0-9-]+)+$/,
  hostname: /^[a-z0-9][a-z0-9-]{0,62}$/,
  ipv4: /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/,
  claudeAccount: /^[a-z0-9][a-z0-9_-]{0,31}$/,
  image: /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?::[0-9]+)?(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?(?:@sha256:[a-f0-9]{64})?$/,
  version: /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
  unquoted: /^[A-Za-z0-9_./:@+-]*$/,
  memory: /^(\d+)g$/i,
} as const;

export const WILDCARD_BIND_ADDRS = ["0.0.0.0", "::", "[::]", "*"] as const;
export const TRUTHY_FLAGS = ["1", "true", "yes"] as const;

export const COMPONENT_BUILD_ARGS: Record<SandboxComponent, string> = {
  android: "WITH_ANDROID",
  flutter: "WITH_FLUTTER",
  mono: "WITH_MONO",
  whisper: "WITH_WHISPER",
};

export const BASE_IMAGE_GB = 4.7;
export const COMPONENT_SIZE_GB: Record<SandboxComponent, number> = {
  android: 0.7,
  flutter: 1.4,
  mono: 0.4,
  whisper: 0.6,
};
export const DISK_BASE_GB = 15;
export const DISK_ROUND_GB = 5;

export const BUILD_STAGES = [
  "controller-build",
  "base",
  "desktop",
  "electron",
  "android-sdk",
  "android",
  "flutter-sdk",
  "flutter",
  "whisper",
  "sandbox",
] as const;
export const HEAVY_STEP = /apt-get install|sdkmanager|flutter precache|cmake|wine|bun install|npm install/;
export const HEAVY_WEIGHT = 10;
export const STEP_NAME = /^\[(?<stage>[a-z0-9_-]+) (?<index>\d+)\/(?<count>\d+)\] (?<cmd>.*)$/;
export const PLAIN_LINE = /^#(?<id>\d+) (?<rest>.*)$/;
export const PLAIN_DONE = /^DONE \d+(\.\d+)?s$/;
export const PLAIN_ERROR = /^ERROR:? (?<message>.*)$/;
export const PLAIN_OUTPUT = /^\d+(\.\d+)? (?<text>.*)$/;
export const RAWJSON_UNSUPPORTED = /invalid progress mode|unknown progress mode|rawjson/i;

export const PULL_DONE_STATUSES = ["Download complete", "Pull complete", "Already exists"] as const;
export const DOCKER_SOCKET_DEFAULTS = {
  unix: "/var/run/docker.sock",
  win32: "//./pipe/docker_engine",
} as const;
