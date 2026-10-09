export const CONTAINER_PREFIX = "tesseract-ct-";
export const SERVER_IMAGE = "tesseract/server:1";
export const SERVER_IMAGE_DIR = ["infra", "docker", "server"] as const;
export const SYSBOX_RUNTIME = "sysbox-runc";
export const CLOUDFLARED_IMAGE = "cloudflare/cloudflared:2026.10.0";
export const DEFAULT_TAILNET_TAGS = "tag:tesseract-server";

export const DOCKER_LABELS = {
  container: "dev.tesseract.container",
  role: "dev.tesseract.role",
} as const;

export const ROLES = { server: "server", tunnel: "tunnel" } as const;

export const IN_CONTAINER = {
  secretsDir: "/etc/tesseract",
  authKey: "/etc/tesseract/authkey",
  tailnetEnv: "/etc/tesseract/tailnet.env",
  dockerData: "/var/lib/docker",
} as const;

export const CONFIG_KEYS = {
  tailscaleKey: "containersTailscaleKey",
  tailscaleKeySealed: "containersTailscaleKeySealed",
  tailscaleTags: "containersTailscaleTags",
  cloudflareToken: "containersCloudflareToken",
  cloudflareTokenSealed: "containersCloudflareTokenSealed",
} as const;

export const SECRET_ENV = {
  tailscaleKey: "TESSERACT_SERVER_TS_AUTHKEY",
  cloudflareToken: "TESSERACT_CLOUDFLARE_TOKEN",
} as const;

export const STATE_FILE = "containers.json";

export const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
export const MANAGED_COMMENT = "managed-by:tesseract";
export const TUNNEL_TARGET_SUFFIX = ".cfargotunnel.com";
export const CATCH_ALL_SERVICE = "http_status:404";

export const NAME_PATTERN = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;
export const HOST_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
export const RESERVED_NAMES: readonly string[] = ["sandbox", "tailscale", "docker", "host", "localhost"];

export const LIMITS = {
  cpus: { min: 0.5, max: 64 },
  memoryMb: { min: 256, max: 262_144 },
  hostname: 253,
  logTail: 300,
} as const;

export const TIMEOUTS = {
  docker: 30_000,
  exec: 10_000,
  api: 20_000,
  build: 30 * 60_000,
} as const;
