export const LEGACY_APP_NAMES = ["Monolith"] as const;
export const LEGACY_CONFIG_DIR_NAMES = ["monolith-desktop", "theone-desktop"] as const;
export const LEGACY_STATE_DIR_NAMES = ["monolith", "theone"] as const;
export const ANDROID_SDK_DIR = "android-sdk";
export const USER_DATA_SKIP = /^(Singleton.*|.*Cache|Crashpad|android-sdk)$/;
export const LOCAL_DATA_SKIP = /^(cache|android-sdk)$/;
export const MIGRATING_SUFFIX = ".migrating";

export const LEGACY_ENV_PREFIXES = ["THEONE_", "MONOLITH_"] as const;
export const ENV_PREFIX = "TESSERACT_";
export const ENV_FILE_NAME = ".env";
export const ENV_BACKUP_SUFFIX = ".legacy-backup";

export const LEGACY_PROJECT = "theone";
export const LEGACY_PROJECTS = ["theone", "monolith"] as const;
export const LEGACY_IMAGES = ["theone/sandbox:latest", "monolith/sandbox:latest"] as const;
export const LEGACY_IMAGE = "theone/sandbox:latest";
export const VOLUME_SUFFIXES = ["workspace", "home", "tailscale", "dind-certs", "dind-data"] as const;
export const COPY_IMAGE_FALLBACKS = ["busybox:latest", "alpine:latest", "debian:trixie-slim"] as const;
export const SKIP_MIGRATION_ENV = "TESSERACT_SKIP_LEGACY_MIGRATION";
export const MARKER_DIR_NAME = "tesseract";
export const volumeMarkerName = (prefix: string) => `legacy-volumes.${prefix}.migrated`;

export const COMPOSE_LABELS = { project: "com.docker.compose.project", volume: "com.docker.compose.volume" } as const;
export const DOCKER_QUICK_MS = 15_000;
export const DOCKER_DOWN_MS = 120_000;
export const VOLUME_COPY_MS = 4 * 60 * 60 * 1000;
export const COPY_SHELL = "/bin/sh";
export const COPY_SCRIPT = "cp -a /from/. /to/";
